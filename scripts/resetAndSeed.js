#!/usr/bin/env node
/**
 * resetAndSeed.js
 *
 * WARNING: This script will DELETE data from the production database and remove
 * image files in the storage/public image folders. It will then run the
 * existing mock-data creation script to populate the site with demo data.
 *
 * Safety: To prevent accidental runs in production this script requires the
 * environment variable FORCE_RESET be set to '1'. Example:
 *
 *   FORCE_RESET=1 node server/scripts/resetAndSeed.js
 *
 * Run this from the repository root (server directory will be used):
 *   cd server
 *   FORCE_RESET=1 node ./scripts/resetAndSeed.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

// Safety guard
if (process.env.FORCE_RESET !== '1') {
    console.error('\n\u26a0\ufe0f FORCE_RESET not set. This script will not run.');
    console.error('To run: FORCE_RESET=1 node server/scripts/resetAndSeed.js');
    process.exit(1);
}

// Use centralized SQL models
const { connectDatabase, sequelize } = require('../config/database');
const models = require('../models/sql');
const { Product, Category, Order, Coupon, Cart, User, Admin, Notification } = models;

const publicImagesDir = path.join(__dirname, '..', 'public', 'images');
const storagePhotosDir = path.join(__dirname, '..', 'storage', 'photos');
const storageVideosDir = path.join(__dirname, '..', 'storage', 'videos');

// Map of image filenames to remote URLs to download (can be updated)
const imageSources = {
    'french-fries.png': 'https://images.unsplash.com/photo-1604908177522-2df3d1a0b8b0?auto=format&fit=crop&w=600&q=60',
    'burgerpatties.png': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=60',
    'readytoeat.png': 'https://images.unsplash.com/photo-1604908177723-3f4b9d2b9a8d?auto=format&fit=crop&w=600&q=60',
    'sauce.jpeg': 'https://images.unsplash.com/photo-1543353071-087092ec393f?auto=format&fit=crop&w=600&q=60',
    'cake.png': 'https://images.unsplash.com/photo-1542281286-9e0a16bb7366?auto=format&fit=crop&w=600&q=60',
    'breadandbase.png': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=60'
};

async function ensureDirs() {
    for (const dir of [publicImagesDir, storagePhotosDir, storageVideosDir]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log('Created directory:', dir);
        }
    }
}

function clearFolder(folder) {
    if (!fs.existsSync(folder)) return;
    const items = fs.readdirSync(folder);
    for (const item of items) {
        const p = path.join(folder, item);
        try {
            const stat = fs.lstatSync(p);
            if (stat.isDirectory()) {
                fs.rmSync(p, { recursive: true, force: true });
            } else {
                fs.unlinkSync(p);
            }
        } catch (err) {
            console.warn('Could not remove', p, err.message || err);
        }
    }
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const req = https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                fs.unlinkSync(dest);
                return reject(new Error(`Failed to download ${url}, status ${res.statusCode}`));
            }
            res.pipe(file);
            file.on('finish', () => file.close(() => resolve(dest)));
        });
        req.on('error', (err) => {
            try { fs.unlinkSync(dest); } catch (e) {}
            reject(err);
        });
    });
}

async function downloadImages() {
    console.log('\n⬇️  Downloading image assets...');
    for (const [filename, url] of Object.entries(imageSources)) {
        const destPublic = path.join(publicImagesDir, filename);
        const destStorage = path.join(storagePhotosDir, filename);
        try {
            console.log(` - Downloading ${filename} from ${url} ...`);
            await downloadFile(url, destPublic);
            // Also copy to storage photos for compatibility
            fs.copyFileSync(destPublic, destStorage);
            console.log(`   ✅ Saved ${filename}`);
        } catch (err) {
            console.warn(`   ⚠️ Failed to download ${filename}:`, err.message || err);
        }
    }
}

async function wipeDatabase() {
    console.log('\n🧹 Wiping database tables (this will DELETE data)');
    try {
        // Order matters due to FKs; destroy children first
        await Notification.destroy({ where: {} });
        await Order.destroy({ where: {} });
        await Cart.destroy({ where: {} });
        await Product.destroy({ where: {} });
        await Category.destroy({ where: {} });
        await Coupon.destroy({ where: {} });
        await User.destroy({ where: {} });
        // Note: Do NOT delete Admin automatically unless you want no admin
        console.log('✅ Database tables cleared');
    } catch (err) {
        console.error('❌ Error wiping database:', err.message || err);
        throw err;
    }
}

async function runCreateMockData() {
    console.log('\n⚙️  Running mock data creation script (createMockData.js)');
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(__dirname, 'createMockData.js')], { stdio: 'inherit', cwd: path.join(__dirname) });
        child.on('exit', (code) => {
            if (code === 0) resolve(); else reject(new Error('createMockData.js exited with code ' + code));
        });
        child.on('error', (err) => reject(err));
    });
}

async function main() {
    console.log('\n=== RESET & SEED: Starting (FORCE_RESET=1 detected) ===');

    await ensureDirs();

    const ok = await connectDatabase();
    if (!ok) {
        console.error('Could not connect to DB. Aborting.');
        process.exit(1);
    }

    try {
        // Wipe DB
        await wipeDatabase();

        // Clear old files
        console.log('\n🗑️  Clearing old image files...');
        clearFolder(publicImagesDir);
        clearFolder(storagePhotosDir);
        clearFolder(storageVideosDir);
        console.log('✅ Cleared image folders');

        // Download fresh images
        await downloadImages();

        // Run existing createMockData script to populate demo data
        await runCreateMockData();

        console.log('\n🎉 Reset and seed completed. Verify the site now.');
    } catch (err) {
        console.error('Reset and seed failed:', err.message || err);
        process.exit(1);
    } finally {
        try { await sequelize.close(); } catch (e) {}
    }
}

main();
