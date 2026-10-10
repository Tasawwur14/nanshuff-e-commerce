#!/usr/bin/env node
/**
 * One-off script to add missing columns to the `orders` table.
 * Specifically adds the `coupon` column if missing.
 * 
 * Safe / idempotent behaviour:
 *  - Describes the table first
 *  - Adds only columns that are missing
 *  - Safe to run multiple times
 *
 * Usage:
 *   node server/scripts/fixOrderSchema.js
 *
 * WARNING: This script alters the DB schema. Run on a backup or staging environment first.
 */

const path = require('path');

async function main() {
    // Load project's sequelize instance and models
    const models = require('../models/sql');
    const sequelize = models.sequelize;
    const queryInterface = sequelize.getQueryInterface();
    const { DataTypes } = require('sequelize');

    const tableName = 'orders';

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
            { name: 'coupon', options: { type: DataTypes.STRING(50), allowNull: true } }
        ];

        let columnsAdded = 0;

        for (const column of columnsToEnsure) {
            if (!tableDesc[column.name]) {
                console.log(`➕ Adding column: ${column.name}`);
                try {
                    await queryInterface.addColumn(tableName, column.name, column.options);
                    console.log(`✅ Column '${column.name}' added successfully`);
                    columnsAdded++;
                } catch (err) {
                    console.error(`❌ Failed to add column '${column.name}':`, err.message || err);
                }
            } else {
                console.log(`⏭️  Column '${column.name}' already exists, skipping`);
            }
        }

        if (columnsAdded > 0) {
            console.log(`\n✅ Successfully added ${columnsAdded} column(s) to '${tableName}'`);
        } else {
            console.log(`\nℹ️  No new columns needed. Table '${tableName}' is up to date.`);
        }

        await sequelize.close();
        console.log('✅ Database connection closed.');
        process.exitCode = 0;

    } catch (error) {
        console.error('❌ Error:', error);
        process.exitCode = 1;
    }
}

main();
