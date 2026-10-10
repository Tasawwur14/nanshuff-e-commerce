#!/usr/bin/env node
/**
 * backfillProductCategory.js
 *
 * Populate the `category` string column for products using the `categoryId` foreign key.
 * This is idempotent and safe to run multiple times.
 */

const { connectDatabase, sequelize } = require('../config/database');
const { Product, Category } = require('../models/sql');

(async function main(){
    console.log('Starting backfillProductCategory...');
    const ok = await connectDatabase();
    if (!ok) { console.error('DB connect failed'); process.exit(1); }
    try {
        const products = await Product.findAll({ where: {} });
        console.log('Products to check:', products.length);
        let updated = 0;
        for (const p of products) {
            const obj = p.toJSON();
            if ((!obj.category || obj.category === null) && obj.categoryId) {
                const cat = await Category.findByPk(obj.categoryId);
                if (cat && cat.name) {
                    await Product.update({ category: cat.name }, { where: { id: obj.id } });
                    updated++;
                }
            }
        }
        console.log('Backfill complete. Updated rows:', updated);
    } catch (e) {
        console.error('Error during backfill:', e.message || e);
        process.exit(1);
    } finally {
        try { await sequelize.close(); } catch (e) {}
    }
    process.exit(0);
})();
