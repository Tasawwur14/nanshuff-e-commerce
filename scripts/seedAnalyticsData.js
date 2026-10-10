#!/usr/bin/env node
/**
 * seedAnalyticsData.js
 *
 * Generates realistic orders across the last 12 months to populate analytics
 * and admin dashboard sections (sales charts, conversion rates, top products).
 *
 * Run after seeding products and users:
 *   node ./scripts/seedAnalyticsData.js
 */

const { connectDatabase, sequelize } = require('../config/database');
const sqlModels = require('../models/sql');
const { Order, Product, User } = sqlModels;

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateWithinMonths(monthsBack) {
    const end = new Date();
    const start = new Date();
    start.setMonth(end.getMonth() - monthsBack);
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function main() {
    console.log('Seeding analytics/orders data...');
    const ok = await connectDatabase();
    if (!ok) {
        console.error('DB connect failed');
        process.exit(1);
    }

    // Fetch products and users
    const products = await Product.findAll();
    const users = await User.findAll();
    if (products.length === 0 || users.length === 0) {
        console.error('Need products and users seeded first (run createMockData.js)');
        process.exit(1);
    }

    // Create a batch of orders
    const statuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

    // We'll create ~500 orders over the last 12 months
    const totalOrders = 500;
    const orders = [];

    for (let i = 0; i < totalOrders; i++) {
        const createdAt = randomDateWithinMonths(12);
        const user = users[randomInt(0, users.length - 1)];
        const itemsCount = randomInt(1, 4);
        const items = [];
        let subtotal = 0;

        for (let j = 0; j < itemsCount; j++) {
            const p = products[randomInt(0, products.length - 1)];
            const qty = randomInt(1, 3);
            const price = Number(p.price || p.mrp || 199);
            const lineTotal = price * qty;
            subtotal += lineTotal;
            items.push({ product: p.id, productName: p.name, quantity: qty, price: price });
        }

        const discountPct = Math.random() > 0.85 ? randomInt(5, 25) : 0; // 15% chance discount
        const discountAmount = subtotal * (discountPct / 100);
        const totalAmount = subtotal - discountAmount + 0; // no shipping for mocks

        // Map statuses by probability
        const roll = Math.random();
        let status = 'pending';
        if (roll > 0.95) status = 'cancelled';
        else if (roll > 0.6) status = 'delivered';
        else if (roll > 0.5) status = 'shipped';
        else if (roll > 0.35) status = 'processing';
        else if (roll > 0.2) status = 'paid';

        const orderNumber = `ORD-${String(Date.now()).slice(-6)}-${i}`;

        orders.push({
            userId: user.id,
            orderNumber,
            items,
            subtotal: subtotal.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            discountPercentage: discountPct,
            totalAmount: totalAmount.toFixed(2),
            status,
            paymentMethod: ['card', 'cod', 'wallet'][randomInt(0,2)],
            paymentStatus: status === 'cancelled' ? 'failed' : (status === 'pending' ? 'pending' : 'completed'),
            paymentId: `PAY_${Math.random().toString(36).substr(2,9)}`,
            shippingAddress: { line1: '123 Demo Street', city: 'Demo City', state: 'State', postalCode: '000000' },
            createdAt,
            updatedAt: createdAt
        });
    }

    // Bulk insert using sequelize
    try {
        await Order.bulkCreate(orders, { validate: true });
        console.log(`Inserted ${orders.length} orders`);
    } catch (err) {
        console.error('Error inserting orders:', err && err.message ? err.message : err);
    } finally {
        try { await sequelize.close(); } catch (e) {}
    }

    console.log('Done seeding analytics/orders data');
}

main();
