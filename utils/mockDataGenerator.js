const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Admin = require('../models/Admin');
const Coupon = require('../models/Coupon');
const bcrypt = require('bcryptjs');

// Mock data generators
const firstNames = ['John', 'Jane', 'Alex', 'Emily', 'Michael', 'Sarah', 'David', 'Laura', 'James', 'Emma', 'Robert', 'Linda', 'William', 'Patricia', 'Richard', 'Maria'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson'];
const productNames = ['Shampoo', 'Conditioner', 'Face Cream', 'Body Lotion', 'Face Wash', 'Serum', 'Face Mask', 'Eye Cream', 'Sunscreen', 'Lip Balm', 'Hair Oil', 'Perfume'];
const categories = ['Hair Care', 'Skin Care', 'Body Care', 'Makeup', 'Fragrance', 'Tools & Accessories'];
const adjectives = ['Ultimate', 'Premium', 'Organic', 'Natural', 'Luxury', 'Essential', 'Advanced', 'Classic', 'Deluxe', 'Eco'];

// Generate random date in the past year
const randomDate = (startDaysAgo = 365) => {
    const start = new Date();
    start.setDate(start.getDate() - startDaysAgo);
    const end = new Date();
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Generate mock users
const generateMockUsers = async (count = 50) => {
    const users = [];
    for (let i = 0; i < count; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        users.push({
            fullName: `${firstName} ${lastName}`,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
            password: await bcrypt.hash('password123', 10),
            createdAt: randomDate(365)
        });
    }
    return users;
};

// Generate mock products
const generateMockProducts = async (count = 30) => {
    const products = [];
    for (let i = 0; i < count; i++) {
        const nameAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const nameNoun = productNames[Math.floor(Math.random() * productNames.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        
        products.push({
            name: `${nameAdjective} ${nameNoun}`,
            sku: `SKU${Math.floor(1000 + Math.random() * 9000)}`,
            category: category,
            mrp: Math.floor(300 + Math.random() * 700), // 300-1000
            discount: Math.floor(5 + Math.random() * 30), // 5-35%
            price: 0, // Will be calculated based on mrp and discount
            stock: Math.floor(50 + Math.random() * 150), // 50-200
            status: 'In Stock',
            short_description: `High-quality ${nameNoun} for daily care.`,
            long_description: `This premium ${nameNoun} is formulated with natural ingredients to provide excellent care for your skin/hair. It's suitable for all skin/hair types and provides long-lasting results.`,
            ingredients: 'Natural ingredients including vitamins and minerals',
            how_to_use: `Apply to clean ${category.toLowerCase() === 'hair care' ? 'hair' : 'skin'} as needed.`,
            tags: `${category}, ${nameNoun}, ${nameAdjective}`,
            imageUrl: `https://placehold.co/300x300/8C6A5D/FFFFFF?text=${nameNoun}`,
            galleryImages: [`https://placehold.co/300x300/8C6A5D/FFFFFF?text=${nameNoun}1`],
        });
    }
    
    // Calculate prices after all products are created
    return products.map(product => ({
        ...product,
        price: product.mrp * (1 - product.discount / 100)
    }));
};

// Generate mock orders
const generateMockOrders = async (userIds, productIds, count = 100) => {
    const orders = [];
    const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    
    for (let i = 0; i < count; i++) {
        const userId = userIds[Math.floor(Math.random() * userIds.length)];
        const numItems = Math.floor(1 + Math.random() * 4); // 1-4 items per order
        const items = [];
        let totalAmount = 0;
        
        for (let j = 0; j < numItems; j++) {
            const productId = productIds[Math.floor(Math.random() * productIds.length)];
            const quantity = Math.floor(1 + Math.random() * 3); // 1-3 of each item
            // For this mock data, we'll create a fixed price, but in real data it would come from the product
            const price = 200 + Math.random() * 800; // 200-1000
            totalAmount += price * quantity;
            
            items.push({
                product: productId,
                quantity: quantity,
                price: price
            });
        }
        
        orders.push({
            user: userId,
            items: items,
            totalAmount: totalAmount,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            createdAt: randomDate(180) // Order in last 180 days
        });
    }
    
    return orders;
};

// Generate mock coupons
const generateMockCoupons = async (count = 10) => {
    const coupons = [];
    const codes = ['WELCOME10', 'SAVE20', 'FREESHIP', 'NEWYEAR30', 'SUMMER15', 'FALL25', 'SPRING20', 'WINTER10', 'BIRTHDAY25', 'REFERRAL15'];
    
    for (let i = 0; i < count; i++) {
        const code = codes[i] || `DISCOUNT${i + 10}`;
        const discount = Math.floor(5 + Math.random() * 25); // 5-30%
        
        coupons.push({
            code: code,
            discount: discount,
            discountValue: discount, // For compatibility with both fields
            discountType: 'percentage',
            isActive: Math.random() > 0.2, // 80% chance of being active
            expiryDate: randomDate(-30), // Expired or in future
            usageLimit: Math.floor(100 + Math.random() * 900) // 100-1000 uses
        });
    }
    
    return coupons;
};

// Generate mock admin
const generateMockAdmin = async () => {
    return {
        username: 'admin',
        fullName: 'Admin User',
        email: 'admin@example.com',
        password: await bcrypt.hash('admin123', 10)
    };
};

// Seed the database with mock data
const seedDatabase = async () => {
    try {
        console.log('Seeding database with mock data...');
        
        // Clear existing data
        await User.deleteMany({});
        await Product.deleteMany({});
        await Order.deleteMany({});
        await Coupon.deleteMany({});
        await Admin.deleteMany({});
        
        // Create mock admin
        const adminData = await generateMockAdmin();
        const admin = new Admin(adminData);
        await admin.save();
        console.log('Created admin user');
        
        // Create mock products
        const productsData = await generateMockProducts(30);
        const products = await Product.insertMany(productsData);
        const productIds = products.map(p => p._id);
        console.log(`Created ${products.length} products`);
        
        // Create mock users
        const usersData = await generateMockUsers(50);
        const users = await User.insertMany(usersData);
        const userIds = users.map(u => u._id);
        console.log(`Created ${users.length} users`);
        
        // Create mock coupons
        const couponsData = await generateMockCoupons(10);
        await Coupon.insertMany(couponsData);
        console.log(`Created ${couponsData.length} coupons`);
        
        // Create mock orders
        const ordersData = await generateMockOrders(userIds, productIds, 100);
        await Order.insertMany(ordersData);
        console.log(`Created ${ordersData.length} orders`);
        
        console.log('Database seeding completed successfully!');
        return true;
    } catch (error) {
        console.error('Error seeding database:', error);
        return false;
    }
};

module.exports = { seedDatabase };