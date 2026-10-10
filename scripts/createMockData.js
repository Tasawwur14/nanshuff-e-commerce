#!/usr/bin/env node
/**
 * Mock Data Generator for E2E Testing
 * Creates categories, products, coupons, and other test data
 */

const { connectDatabase, sequelize } = require('../config/database');
const { Category, Product, Coupon, Admin, User } = require('../models/sql');
const path = require('path');
const fs = require('fs');

const imageMap = {
    'french-fries.png': 'French Fries',
    'burgerpatties.png': 'Burger Patties',
    'readytoeat.png': 'Ready to Eat',
    'sauce.jpeg': 'Curries | Marinations | Sauces',
    'cake.png': 'Creamy & Dry Cakes',
    'breadandbase.png': 'Breads & Pizza Base'
};

const mockProducts = {
    'French Fries': [
        { name: 'Golden Crunch Fries 500g', description: 'Crispy golden fries made from premium potatoes', price: 149, stock: 100, image: 'french-fries.png' },
        { name: 'Waffle Cut Fries 400g', description: 'Perfect waffle-cut fries for ultimate crispiness', price: 129, stock: 80, image: 'french-fries.png' },
        { name: 'Shoestring Fries 300g', description: 'Thin and crispy shoestring cut fries', price: 99, stock: 120, image: 'french-fries.png' },
        { name: 'Steak Cut Fries 500g', description: 'Thick-cut steak fries with soft interior', price: 169, stock: 60, image: 'french-fries.png' },
        { name: 'Curly Fries Deluxe 400g', description: 'Twisted curly fries with enhanced flavor', price: 139, stock: 90, image: 'french-fries.png' }
    ],
    'Burger Patties': [
        { name: 'Classic Beef Patty 200g', description: 'Traditional beef patty perfect for burgers', price: 199, stock: 150, image: 'burgerpatties.png' },
        { name: 'Cheese Stuffed Patty 250g', description: 'Beef patty with melted cheese inside', price: 249, stock: 70, image: 'burgerpatties.png' },
        { name: 'Spiced Chicken Patty 180g', description: 'Seasoned chicken patty with Indian spices', price: 179, stock: 100, image: 'burgerpatties.png' },
        { name: 'Mutton Patty 200g', description: 'Premium mutton patty for gourmet burgers', price: 229, stock: 50, image: 'burgerpatties.png' },
        { name: 'Veggie Patty 160g', description: 'Delicious vegetarian patty made with mixed vegetables', price: 139, stock: 80, image: 'burgerpatties.png' }
    ],
    'Ready to Eat': [
        { name: 'Tandoori Chicken 300g', description: 'Authentic tandoori chicken ready to heat and eat', price: 289, stock: 60, image: 'readytoeat.png' },
        { name: 'Biryani Mix 400g', description: 'Pre-cooked biryani just needs heating', price: 249, stock: 75, image: 'readytoeat.png' },
        { name: 'Samosa Pack 250g', description: 'Golden crispy samosas with filling', price: 159, stock: 100, image: 'readytoeat.png' },
        { name: 'Spring Rolls 200g', description: 'Crispy spring rolls with vegetable filling', price: 139, stock: 85, image: 'readytoeat.png' },
        { name: 'Paneer Tikka 250g', description: 'Marinated paneer pieces ready to cook', price: 219, stock: 70, image: 'readytoeat.png' }
    ],
    'Curries | Marinations | Sauces': [
        { name: 'Butter Chicken Sauce 500ml', description: 'Rich and creamy butter chicken sauce', price: 189, stock: 80, image: 'sauce.jpeg' },
        { name: 'Tikka Marinade 250ml', description: 'Authentic Indian tikka marinade', price: 129, stock: 110, image: 'sauce.jpeg' },
        { name: 'Green Chutney 300ml', description: 'Fresh green coriander chutney', price: 99, stock: 90, image: 'sauce.jpeg' },
        { name: 'Red Curry Sauce 400ml', description: 'Spicy red curry sauce for Thai dishes', price: 159, stock: 60, image: 'sauce.jpeg' },
        { name: 'Tandoori Mix 200g', description: 'Dry tandoori masala spice blend', price: 89, stock: 150, image: 'sauce.jpeg' }
    ],
    'Creamy & Dry Cakes': [
        { name: 'Black Forest Cake 500g', description: 'Chocolate cake with cherries and cream', price: 399, stock: 30, image: 'cake.png' },
        { name: 'Red Velvet Cake 400g', description: 'Elegant red velvet with cream cheese frosting', price: 349, stock: 25, image: 'cake.png' },
        { name: 'Chocolate Brownie Cake 350g', description: 'Rich fudgy chocolate brownie', price: 299, stock: 40, image: 'cake.png' },
        { name: 'Vanilla Sponge 400g', description: 'Light and fluffy vanilla sponge cake', price: 249, stock: 50, image: 'cake.png' },
        { name: 'Eggless Chocolate Cake 450g', description: 'Delicious eggless chocolate cake', price: 299, stock: 35, image: 'cake.png' }
    ],
    'Breads & Pizza Base': [
        { name: 'Thin Crust Pizza Base 12inch', description: 'Thin and crispy pizza base', price: 99, stock: 100, image: 'breadandbase.png' },
        { name: 'Thick Crust Pizza Base 12inch', description: 'Thick and fluffy pizza base', price: 129, stock: 80, image: 'breadandbase.png' },
        { name: 'Naan Bread Pack 300g', description: 'Fresh frozen naan bread (5 pieces)', price: 89, stock: 120, image: 'breadandbase.png' },
        { name: 'Paratha Pack 400g', description: 'Whole wheat paratha (4 pieces)', price: 79, stock: 110, image: 'breadandbase.png' },
        { name: 'Garlic Bread 250g', description: 'Garlic flavored bread slices', price: 69, stock: 150, image: 'breadandbase.png' }
    ]
};

const mockCoupons = [
    { code: 'WELCOME10', discount: 10, expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    { code: 'FROZEN15', discount: 15, expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
    { code: 'SAVE20', discount: 20, expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    { code: 'EXPIRED', discount: 25, expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }
];

const mockUsers = [
    { email: 'user1@example.com', password: 'User@1234', name: 'John Doe' },
    { email: 'user2@example.com', password: 'User@1234', name: 'Jane Smith' },
    { email: 'user3@example.com', password: 'User@1234', name: 'Ahmed Khan' }
];

async function createCategories() {
    console.log('\n📦 Creating categories...');
    const categories = [];
    
    for (const [imageName, categoryName] of Object.entries(imageMap)) {
        try {
            const [category, created] = await Category.findOrCreate({
                where: { name: categoryName },
                defaults: {
                    name: categoryName,
                    description: `Premium ${categoryName.toLowerCase()} collection`,
                    image: imageName
                }
            });
            if (created) {
                console.log(`   ✅ Created category: ${categoryName}`);
            } else {
                console.log(`   ⏭️  Category exists: ${categoryName}`);
            }
            categories.push(category);
        } catch (error) {
            console.error(`   ❌ Error creating category ${categoryName}:`, error.message);
        }
    }
    return categories;
}

async function createProducts(categories) {
    console.log('\n🛒 Creating products...');
    let productCount = 0;
    
    for (const [categoryName, products] of Object.entries(mockProducts)) {
        const category = categories.find(c => c.name === categoryName);
        if (!category) {
            console.log(`   ⚠️  Category not found: ${categoryName}`);
            continue;
        }

        for (const productData of products) {
            try {
                const [product, created] = await Product.findOrCreate({
                    where: { name: productData.name },
                    defaults: {
                        name: productData.name,
                        description: productData.description,
                        price: productData.price,
                        stock: productData.stock,
                        categoryId: category.id,
                        category: category.name,
                        image: productData.image,
                        sku: `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        featured: Math.random() > 0.7 // 30% chance to be featured
                    }
                });
                if (created) {
                    productCount++;
                    console.log(`   ✅ Created: ${productData.name} (₹${productData.price})`);
                }
            } catch (error) {
                console.error(`   ❌ Error creating product ${productData.name}:`, error.message);
            }
        }
    }
    console.log(`   📊 Total products created: ${productCount}`);
}

async function createCoupons() {
    console.log('\n🎟️  Creating coupons...');
    let couponCount = 0;
    
    for (const couponData of mockCoupons) {
        try {
            const [coupon, created] = await Coupon.findOrCreate({
                where: { code: couponData.code },
                defaults: {
                    code: couponData.code,
                    discount: couponData.discount,
                    expiryDate: couponData.expiryDate
                }
            });
            if (created) {
                couponCount++;
                const expired = new Date() > couponData.expiryDate ? '(EXPIRED)' : '';
                console.log(`   ✅ Created coupon: ${couponData.code} (${couponData.discount}% off) ${expired}`);
            }
        } catch (error) {
            console.error(`   ❌ Error creating coupon ${couponData.code}:`, error.message);
        }
    }
    console.log(`   📊 Total coupons created: ${couponCount}`);
}

async function createTestUsers() {
    console.log('\n👥 Creating test users...');
    let userCount = 0;
    
    for (const userData of mockUsers) {
        try {
            const [user, created] = await User.findOrCreate({
                where: { email: userData.email },
                defaults: {
                    email: userData.email,
                    password: userData.password,
                    name: userData.name
                }
            });
            if (created) {
                userCount++;
                console.log(`   ✅ Created user: ${userData.name} (${userData.email})`);
            }
        } catch (error) {
            console.error(`   ❌ Error creating user ${userData.email}:`, error.message);
        }
    }
    console.log(`   📊 Total users created: ${userCount}`);
}

async function main() {
    console.log('🚀 Starting mock data creation...');
    
    try {
        // Connect to database
        const connected = await connectDatabase();
        if (!connected) {
            console.error('❌ Failed to connect to database');
            process.exit(1);
        }

        // Create data
        const categories = await createCategories();
        await createProducts(categories);
        await createCoupons();
        await createTestUsers();

        console.log('\n✅ Mock data creation completed successfully!');
        console.log('\n📝 Test Credentials:');
        console.log('   Admin: NanshhufAdmin / NanshhufAdmin@1234');
        console.log('   Users: user1@example.com / User@1234');
        console.log('   Users: user2@example.com / User@1234');
        console.log('   Coupons: WELCOME10 (10%), FROZEN15 (15%), SAVE20 (20%), EXPIRED (expired)');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Run the script
main();
