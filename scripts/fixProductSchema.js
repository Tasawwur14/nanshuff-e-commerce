#!/usr/bin/env node
/**
 * One-off script to add missing columns to the `products` table used by Sequelize models.
 * Safe / idempotent behaviour:
 *  - Describes the table first
 *  - Adds only columns that are missing
 *  - Tries to add JSON columns but falls back to TEXT when JSON isn't supported by the DB
 *  - Adds a unique index on `sku` if it's missing
 *
 * Usage:
 *   node server/scripts/fixProductSchema.js
 *
 * WARNING: Run this on a backup or staging environment first. This script alters the DB schema.
 */

const path = require('path');

async function main() {
    // Load project's sequelize instance and models
    const models = require('../models/sql');
    const sequelize = models.sequelize;
    const queryInterface = sequelize.getQueryInterface();
    const { DataTypes } = require('sequelize');

    const tableName = 'products';

    try {
        console.log('⏳ Authenticating DB connection...');
        await sequelize.authenticate();
        console.log('✅ DB authenticated.');

        console.log(`🔎 Describing table: ${tableName}`);
        let tableDesc = {};
        try {
            tableDesc = await queryInterface.describeTable(tableName);
        } catch (err) {
            console.error(`❌ Could not describe table '${tableName}':`, err.message || err);
            process.exitCode = 2;
            return;
        }

        // Columns we expect based on model
        const columnsToEnsure = [
            { name: 'sku', options: { type: DataTypes.STRING(50), allowNull: true } },
            { name: 'image', options: { type: DataTypes.STRING(255), allowNull: true } },
            { name: 'imageUrl', options: { type: DataTypes.STRING(500), allowNull: true } },
            { name: 'images', options: { type: DataTypes.JSON, allowNull: true } },
            { name: 'videoUrl', options: { type: DataTypes.STRING(500), allowNull: true } },
            { name: 'mrp', options: { type: DataTypes.DECIMAL(10,2), allowNull: true } },
            { name: 'short_description', options: { type: DataTypes.TEXT, allowNull: true } },
            { name: 'long_description', options: { type: DataTypes.TEXT, allowNull: true } },
            { name: 'how_to_use', options: { type: DataTypes.TEXT, allowNull: true } }
        ];

        for (const col of columnsToEnsure) {
            if (tableDesc[col.name]) {
                console.log(`- Column exists: ${col.name}`);
                continue;
            }

            console.log(`+ Adding column: ${col.name} ...`);
            try {
                // Try to add the column as requested
                await queryInterface.addColumn(tableName, col.name, col.options);
                console.log(`  ✅ Added column: ${col.name}`);
            } catch (err) {
                console.warn(`  ⚠️ Failed to add column ${col.name} with requested type: ${err.message || err}`);
                // If JSON column failed (common on older MySQL), try TEXT fallback
                if (col.options.type === DataTypes.JSON) {
                    try {
                        await queryInterface.addColumn(tableName, col.name, { type: DataTypes.TEXT, allowNull: true });
                        console.log(`  ✅ Added column ${col.name} as TEXT fallback`);
                    } catch (err2) {
                        console.error(`  ❌ Could not add fallback column ${col.name}:`, err2.message || err2);
                    }
                } else {
                    console.error(`  ❌ Could not add column ${col.name}:`, err.message || err);
                }
            }
        }

        // Ensure unique index on sku (if column exists)
        if (tableDesc.sku || (await queryInterface.describeTable(tableName)).sku) {
            console.log('\n🔐 Ensuring unique index on `sku`');
            try {
                // List existing indexes
                const existingIndexes = await queryInterface.showIndex(tableName);
                const indexName = 'products_sku_unique';
                const alreadyExists = existingIndexes.some(ix => ix.name === indexName || (ix.fields && ix.fields.some(f => f.attribute === 'sku')));
                if (alreadyExists) {
                    console.log(' - Unique index on sku already exists.');
                } else {
                    await queryInterface.addIndex(tableName, ['sku'], { unique: true, name: indexName });
                    console.log(' - Added unique index on sku.');
                }
            } catch (err) {
                console.error(' - Could not ensure index on sku:', err.message || err);
            }
        } else {
            console.log('\nℹ️ Skipping sku index because column sku is not present after attempts.');
        }

        console.log('\nAll done. Please verify your application and restart the server if needed.');
    } catch (err) {
        console.error('Fatal error while fixing schema:', err.message || err);
        process.exitCode = 1;
    } finally {
        try { await sequelize.close(); } catch (e) {}
    }
}

main();
