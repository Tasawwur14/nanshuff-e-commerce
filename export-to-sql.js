#!/usr/bin/env node

/**
 * Export SQLite Database to SQL File (MySQL/PostgreSQL Compatible)
 * Usage: node export-to-sql.js
 * Output: database-export.sql
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'database.sqlite');
const OUTPUT_FILE = 'database-export.sql';

let sqlContent = '';

// SQL Header
sqlContent += '-- Nanshhuf E-Commerce Platform Database Export\n';
sqlContent += `-- Generated: ${new Date().toISOString()}\n`;
sqlContent += '-- MySQL/PostgreSQL Compatible\n';
sqlContent += '-- Import with: mysql -u user -p database < database-export.sql\n\n';

// Add safety settings
sqlContent += 'SET FOREIGN_KEY_CHECKS=0;\n\n';

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to SQLite database');
    exportDatabase();
});

function exportDatabase() {
    // Get all table names
    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;", (err, tables) => {
        if (err) {
            console.error('❌ Error reading tables:', err.message);
            process.exit(1);
        }

        console.log(`📊 Found ${tables.length} tables to export...`);
        exportTables(tables, 0);
    });
}

function exportTables(tables, index) {
    if (index >= tables.length) {
        // All tables exported
        sqlContent += '\nSET FOREIGN_KEY_CHECKS=1;\n';
        sqlContent += '\n-- Export completed successfully\n';
        
        // Write to file
        const outputPath = path.join(__dirname, OUTPUT_FILE);
        fs.writeFileSync(outputPath, sqlContent);
        console.log(`✅ Export completed! File: ${OUTPUT_FILE}`);
        console.log(`📁 Size: ${(sqlContent.length / 1024).toFixed(2)} KB`);
        
        db.close();
        process.exit(0);
        return;
    }

    const tableName = tables[index].name;
    console.log(`📤 Exporting table: ${tableName}...`);

    // Get table schema
    db.all(`PRAGMA table_info(${tableName});`, (err, columns) => {
        if (err) {
            console.error(`❌ Error reading table schema for ${tableName}:`, err.message);
            exportTables(tables, index + 1);
            return;
        }

        // Create table statement
        let createTableSQL = `\n-- Table: ${tableName}\nDROP TABLE IF EXISTS \`${tableName}\`;\nCREATE TABLE \`${tableName}\` (\n`;
        
        const columnDefs = columns.map((col, i) => {
            let def = `  \`${col.name}\` `;
            
            // Map SQLite types to MySQL types
            const type = col.type.toUpperCase();
            if (type.includes('INT')) {
                def += 'INT';
                if (col.pk) def += ' PRIMARY KEY AUTO_INCREMENT';
            } else if (type.includes('TEXT')) {
                def += 'LONGTEXT';
            } else if (type.includes('BLOB')) {
                def += 'LONGBLOB';
            } else if (type.includes('REAL')) {
                def += 'DECIMAL(10,2)';
            } else {
                def += type;
            }
            
            if (!col.notnull && !col.pk) def += ' NULL';
            else if (col.pk) def += ' NOT NULL';
            else def += ' NOT NULL';
            
            if (i === columns.length - 1) def += '\n';
            else def += ',\n';
            
            return def;
        });

        createTableSQL += columnDefs.join('');
        createTableSQL += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n';
        
        sqlContent += createTableSQL;

        // Get table data
        db.all(`SELECT * FROM ${tableName};`, (err, rows) => {
            if (err) {
                console.error(`❌ Error reading data from ${tableName}:`, err.message);
                exportTables(tables, index + 1);
                return;
            }

            if (rows && rows.length > 0) {
                sqlContent += `\n-- Data for table: ${tableName} (${rows.length} rows)\n`;
                sqlContent += `INSERT INTO \`${tableName}\` (${columns.map(c => '`' + c.name + '`').join(', ')}) VALUES\n`;

                const valueStrings = rows.map((row, rowIndex) => {
                    const values = columns.map(col => {
                        const val = row[col.name];
                        if (val === null || val === undefined) {
                            return 'NULL';
                        } else if (typeof val === 'number') {
                            return val.toString();
                        } else if (typeof val === 'boolean') {
                            return val ? '1' : '0';
                        } else {
                            // Escape single quotes and handle special characters
                            return "'" + val.toString().replace(/'/g, "''") + "'";
                        }
                    }).join(', ');

                    let line = `(${values})`;
                    if (rowIndex < rows.length - 1) line += ',';
                    line += '\n';
                    return line;
                });

                sqlContent += valueStrings.join('');
                sqlContent += ';\n';
            } else {
                sqlContent += `\n-- No data in table: ${tableName}\n`;
            }

            exportTables(tables, index + 1);
        });
    });
}

process.on('error', (err) => {
    console.error('❌ Process error:', err.message);
    process.exit(1);
});
