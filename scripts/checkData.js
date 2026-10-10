#!/usr/bin/env node
/**
 * checkData.js - diagnostic script to print counts of main tables
 */

async function main() {
    try {
        const models = require('../models/sql');
        const { sequelize, Category, Product, User, Order, Coupon } = models;
        await sequelize.authenticate();
        console.log('DB connected. Fetching counts...\n');

        const [catCount, prodCount, userCount, orderCount, couponCount] = await Promise.all([
            Category.count(),
            Product.count(),
            User.count(),
            Order.count(),
            Coupon.count()
        ]);

        console.log(`Categories: ${catCount}`);
        console.log(`Products:   ${prodCount}`);
        console.log(`Users:      ${userCount}`);
        console.log(`Orders:     ${orderCount}`);
        console.log(`Coupons:    ${couponCount}`);

        await sequelize.close();
    } catch (err) {
        console.error('Error checking data:', err && err.message ? err.message : err);
        process.exitCode = 2;
    }
}

main();
