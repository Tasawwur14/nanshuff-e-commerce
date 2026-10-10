#!/usr/bin/env node
/**
 * fullResetAndSeed.js
 *
 * Single script that:
 *  - Ensures product schema (adds missing columns)
 *  - Wipes main data tables (keeps Admins)
 *  - Clears image folders
 *  - Downloads image assets
 *  - Seeds categories, products (with imageUrl pointing to /images/..), coupons, users
 *  - Seeds orders (analytics)
 *
 * WARNING: This will DELETE data. Use only when you are sure. Requires FORCE_RESET=1
 *
 * Usage:
 *   cd server
 *   $env:FORCE_RESET='1'  # PowerShell
 *   node .\scripts\fullResetAndSeed.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

if (process.env.FORCE_RESET !== '1') {
    console.error('\n\u26a0\ufe0f FORCE_RESET not set. Aborting.');
    console.error("Set FORCE_RESET=1 and run the script to proceed.");
    process.exit(1);
}

const { connectDatabase, sequelize } = require('../config/database');
const models = require('../models/sql');
const { Product, Category, User, Order, Coupon, Cart, Notification } = models;
const { DataTypes } = require('sequelize');

const publicImagesDir = path.join(__dirname, '..', 'public', 'images');
const storagePhotosDir = path.join(__dirname, '..', 'storage', 'photos');
const storageVideosDir = path.join(__dirname, '..', 'storage', 'videos');

const imageSources = {
    'french-fries.png': 'https://images.unsplash.com/photo-1604908177522-2df3d1a0b8b0?auto=format&fit=crop&w=800&q=60',
    'burgerpatties.png': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=60',
    'readytoeat.png': 'https://images.unsplash.com/photo-1604908177723-3f4b9d2b9a8d?auto=format&fit=crop&w=800&q=60',
    'sauce.jpeg': 'https://images.unsplash.com/photo-1543353071-087092ec393f?auto=format&fit=crop&w=800&q=60',
    'cake.png': 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?auto=format&fit=crop&w=800&q=60',
    'breadandbase.png': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=60'
};

async function ensureDirs() {
    for (const dir of [publicImagesDir, storagePhotosDir, storageVideosDir]) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

function clearFolder(folder) {
    if (!fs.existsSync(folder)) return;
    for (const name of fs.readdirSync(folder)) {
        const p = path.join(folder, name);
        try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    }
}

function downloadFile(url, dest, redirectCount = 0) {
    const MAX_REDIRECTS = 5;
    const TIMEOUT_MS = 20000; // 20s
    return new Promise((resolve, reject) => {
        if (redirectCount > MAX_REDIRECTS) return reject(new Error('Too many redirects'));

        const file = fs.createWriteStream(dest);
        const req = https.get(url, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Close current stream and try redirected location
                file.close();
                try { fs.unlinkSync(dest); } catch (e) {}
                const newUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
                return resolve(downloadFile(newUrl, dest, redirectCount + 1));
            }

            if (res.statusCode && res.statusCode >= 400) {
                file.close();
                try { fs.unlinkSync(dest); } catch (e) {}
                return reject(new Error('Failed ' + res.statusCode));
            }

            res.pipe(file);
            let finished = false;
            file.on('finish', () => {
                finished = true;
                file.close(() => resolve(dest));
            });

            // Safety timeout in case stream hangs. Also set socket timeout.
            const timeout = setTimeout(() => {
                if (!finished) {
                    try { req.destroy(new Error('Download timed out')); } catch (e) {}
                    try { file.close(); fs.unlinkSync(dest); } catch (e) {}
                    reject(new Error('Download timed out'));
                }
            }, TIMEOUT_MS);

            // Clear timeout when request finishes or closes
            req.on('close', () => clearTimeout(timeout));
            req.on('timeout', () => {
                try { req.destroy(new Error('Request socket timeout')); } catch (e) {}
            });
            // set socket timeout
            req.setTimeout(TIMEOUT_MS);
        });

        req.on('error', (err) => {
            try { file.close(); fs.unlinkSync(dest); } catch (e) {}
            reject(err);
        });
    });
}

async function ensureProductSchema() {
    const qi = sequelize.getQueryInterface();
    const table = 'products';
    try {
        const desc = await qi.describeTable(table);
        const wants = {
            sku: { type: DataTypes.STRING(50), allowNull: true },
            image: { type: DataTypes.STRING(255), allowNull: true },
            imageUrl: { type: DataTypes.STRING(500), allowNull: true },
            images: { type: DataTypes.JSON, allowNull: true },
            videoUrl: { type: DataTypes.STRING(500), allowNull: true },
            mrp: { type: DataTypes.DECIMAL(10,2), allowNull: true }
        };
        for (const [col, def] of Object.entries(wants)) {
            if (!desc[col]) {
                try { await qi.addColumn(table, col, def); console.log('Added column', col); }
                catch (e) {
                    if (def.type === DataTypes.JSON) {
                        await qi.addColumn(table, col, { type: DataTypes.TEXT, allowNull: true });
                        console.log('Added column (TEXT fallback)', col);
                    } else console.warn('Failed to add', col, e.message || e);
                }
            }
        }
        // ensure unique index on sku
        try {
            const indexes = await qi.showIndex(table);
            const exists = indexes.some(ix => ix && ix.fields && ix.fields.some(f => f.attribute === 'sku'));
            if (!exists) await qi.addIndex(table, ['sku'], { unique: true, name: 'ux_products_sku' });
        } catch (e) { console.warn('Index creation failed:', e.message || e); }
    } catch (e) {
        console.warn('Could not describe products table (it may not exist yet):', e.message || e);
    }
}

async function downloadImages() {
    console.log('Downloading images...');
    const entries = Object.entries(imageSources);
    const concurrency = 3;
    let index = 0;

    async function worker() {
        while (index < entries.length) {
            const i = index++;
            const [name, url] = entries[i];
            const destPub = path.join(publicImagesDir, name);
            const destStor = path.join(storagePhotosDir, name);
            try {
                await downloadFile(url, destPub);
                fs.copyFileSync(destPub, destStor);
                console.log('Saved', name);
            } catch (e) {
                console.warn('Download failed for', name, e.message || e);
                try {
                    const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#e2e8f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="24">${name}</text></svg>`;
                    fs.writeFileSync(destPub, svg);
                    fs.copyFileSync(destPub, destStor);
                    console.log('Wrote placeholder for', name);
                } catch (e2) { console.warn('Failed to write placeholder for', name, e2.message || e2); }
            }
        }
    }

    const workers = [];
    for (let w = 0; w < concurrency; w++) workers.push(worker());
    await Promise.all(workers);
}

async function wipeData() {
    console.log('Wiping data...');
    await Notification.destroy({ where: {} });
    await Order.destroy({ where: {} });
    await Cart.destroy({ where: {} });
    await Product.destroy({ where: {} });
    await Category.destroy({ where: {} });
    await Coupon.destroy({ where: {} });
    await User.destroy({ where: {} });
    console.log('Data wiped');
}

async function seedCoreData() {
    console.log('Seeding categories/products/users/coupons...');
    // categories and sample products (similar to createMockData.js)
    const imageMap = {
        'french-fries.png': 'French Fries',
        'burgerpatties.png': 'Burger Patties',
        'readytoeat.png': 'Ready to Eat',
        'sauce.jpeg': 'Curries | Marinations | Sauces',
        'cake.png': 'Creamy & Dry Cakes',
        'breadandbase.png': 'Breads & Pizza Base'
    };

    const categoryRows = [];
    for (const [imageName, categoryName] of Object.entries(imageMap)) {
        const [cat] = await Category.findOrCreate({ where: { name: categoryName }, defaults: { name: categoryName, image: `/images/${imageName}`, description: `Demo ${categoryName}` } });
        categoryRows.push(cat);
    }

    // sample products per category (kept small but varied)
    const samples = {
        'French Fries': ['Golden Crunch Fries 500g','Waffle Cut Fries 400g','Shoestring Fries 300g'],
        'Burger Patties': ['Classic Beef Patty 200g','Cheese Stuffed Patty 250g','Veggie Patty 160g'],
        'Ready to Eat': ['Tandoori Chicken 300g','Biryani Mix 400g','Samosa Pack 250g'],
        'Curries | Marinations | Sauces': ['Butter Chicken Sauce 500ml','Tikka Marinade 250ml','Green Chutney 300ml'],
        'Creamy & Dry Cakes': ['Black Forest Cake 500g','Red Velvet Cake 400g','Chocolate Brownie Cake 350g'],
        'Breads & Pizza Base': ['Thin Crust Pizza Base 12inch','Thick Crust Pizza Base 12inch','Naan Bread Pack 300g']
    };

    const createdProducts = [];
    for (const cat of categoryRows) {
        const list = samples[cat.name] || [];
        for (const name of list) {
            const sku = `SKU-${Math.random().toString(36).substr(2,8).toUpperCase()}`;
            const price = Math.floor(80 + Math.random()*300);
            const imageFile = Object.keys(imageMap).find(k => imageMap[k] === cat.name) || Object.keys(imageMap)[0];
            const imageUrl = `/images/${imageFile}`;
            const [p] = await Product.findOrCreate({ where: { name }, defaults: {
                name, price, stock: Math.floor(20 + Math.random()*200), categoryId: cat.id, image: imageFile, imageUrl, sku, featured: Math.random()>0.7,
                short_description: `Demo ${name}`, long_description: `Detailed description for ${name}`
            }});
            createdProducts.push(p);
        }
    }

    // coupons
    const coupons = [ {code:'WELCOME10', discount:10}, {code:'FROZEN15', discount:15}, {code:'SAVE20', discount:20} ];
    for (const c of coupons) await Coupon.findOrCreate({ where: { code: c.code }, defaults: { code: c.code, discount: c.discount, expiryDate: new Date(Date.now() + 30*24*3600*1000) } });

    // users
    const usersToCreate = [ {name:'John Demo', email:'user1@example.com', password:'User@1234'}, {name:'Jane Demo', email:'user2@example.com', password:'User@1234'} ];
    for (const u of usersToCreate) await User.findOrCreate({ where: { email: u.email }, defaults: { name: u.name, email: u.email, password: u.password } });

    console.log('Core data seeded');
    return { products: createdProducts };
}

function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}

async function seedOrders(products) {
    console.log('Seeding orders for analytics...');
    const users = await User.findAll();
    const totalOrders = 500;
    const orders = [];
    for (let i=0;i<totalOrders;i++){
        const createdAt = new Date(Date.now() - Math.floor(Math.random()*365)*24*3600*1000);
        const user = users[randomInt(0, users.length-1)];
        const itemsCount = randomInt(1,4);
        const items = [];
        let subtotal = 0;
        for (let j=0;j<itemsCount;j++){
            const p = products[randomInt(0, products.length-1)];
            const qty = randomInt(1,3);
            const price = Number(p.price || 199);
            items.push({ product: p.id, productName: p.name, quantity: qty, price });
            subtotal += price*qty;
        }
        const discountPct = Math.random()>0.85?randomInt(5,25):0;
        const discountAmount = subtotal*(discountPct/100);
        const total = subtotal - discountAmount;
        const roll = Math.random();
        let status = 'pending';
        if (roll>0.95) status='cancelled'; else if (roll>0.6) status='delivered'; else if (roll>0.5) status='shipped'; else if (roll>0.35) status='processing'; else if (roll>0.2) status='paid';
        orders.push({ userId: user.id, orderNumber: `ORD-${Date.now().toString().slice(-6)}-${i}`, items, subtotal, discountAmount, discountPercentage:discountPct, totalAmount: total, status, paymentMethod: 'card', paymentStatus: status==='cancelled'?'failed':'completed', paymentId: `PAY_${Math.random().toString(36).substr(2,9)}`, shippingAddress: {line1:'Demo'}, createdAt, updatedAt: createdAt });
    }
    try { await Order.bulkCreate(orders); console.log('Inserted', orders.length, 'orders'); } catch(e){ console.warn('Orders insert failed:', e.message || e); }
}

async function main(){
    console.log('=== fullResetAndSeed started ===');
    await ensureDirs();
    const ok = await connectDatabase();
    if (!ok) { console.error('DB connect failed'); process.exit(1); }
    try {
        await ensureProductSchema();
        await wipeData();
        clearFolder(publicImagesDir);
        clearFolder(storagePhotosDir);
        clearFolder(storageVideosDir);
        await downloadImages();
        const { products } = await seedCoreData();
            // Ensure category string fields are populated for all products (idempotent)
            await (async function ensureCategoryStrings(){
                try {
                    console.log('Ensuring product.category strings are populated...');
                    const all = await Product.findAll();
                    let updated = 0;
                    for (const p of all) {
                        const obj = p.toJSON();
                        if ((!obj.category || obj.category === null || String(obj.category).trim() === '') && obj.categoryId) {
                            const cat = await Category.findByPk(obj.categoryId);
                            if (cat && cat.name) {
                                await Product.update({ category: cat.name }, { where: { id: obj.id } });
                                updated++;
                            }
                        }
                    }
                    console.log('Category strings ensured. Updated rows:', updated);
                } catch (e) { console.warn('ensureCategoryStrings failed:', e.message || e); }
            })();
        await seedOrders(products);
        console.log('=== fullResetAndSeed completed ===');
    } catch (e) { console.error('Error:', e.message || e); try{ await sequelize.close(); } catch(e){} process.exit(1); }
    finally { try{ await sequelize.close(); } catch(e){} }

    // Ensure process exits when done (close any dangling handles)
    try { process.exit(0); } catch (e) { /* ignore */ }
}

main();
