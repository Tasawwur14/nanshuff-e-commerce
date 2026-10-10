const { Sequelize } = require('sequelize');
require('dotenv').config();

// Single-source DB: SQL via Sequelize. Default to sqlite for local dev.
const DB_TYPE = process.env.DB_TYPE || 'sqlite';

let sequelize = null;

if (DB_TYPE === 'mysql' || DB_TYPE === 'postgresql') {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || (DB_TYPE === 'mysql' ? 3306 : 5432),
        dialect: DB_TYPE,
        logging: false,
        pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
    };

    sequelize = new Sequelize(process.env.DB_NAME || 'nanshhuf', process.env.DB_USER || 'root', process.env.DB_PASSWORD || '', dbConfig);
} else {
    // sqlite default - with optimizations for concurrency
    const dbFile = process.env.SQLITE_STORAGE || './database.sqlite';
    const sqlite3 = require('sqlite3');
    sequelize = new Sequelize({ 
        dialect: 'sqlite', 
        storage: dbFile, 
        logging: false,
        // SQLite concurrency optimizations
        pool: {
            max: 5,  // Reduced from 10 to prevent too many concurrent connections
            min: 1,
            idle: 5000,  // Reduced idle timeout
            acquire: 90000  // Increased from 60000 to 90 seconds
        },
        dialectOptions: {
            // Enable WAL mode for better concurrency
            mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
            busyTimeout: 60000  // Wait up to 60 seconds if database is busy (increased from 30000)
        },
        // Increase timeout for SQLite locks - more retries and longer backoff
        retry: { max: 10, backoffBase: 500 }  // Increased max retries to 10, adjusted backoff
    });
}

const connectDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log(`✅ ${DB_TYPE.toUpperCase()} Database Connected!`);
        
        // Load all SQL models to ensure they're registered before sync
        // This is critical for alter: true to work properly in MySQL/PostgreSQL
        try {
            const sqlModels = require('../models/sql');
            console.log('✅ SQL models loaded and initialized');
        } catch (modelErr) {
            console.warn('⚠️  Warning: Could not load SQL models before sync:', modelErr.message);
        }
        
        // Enable WAL mode for SQLite to improve concurrency
        if (DB_TYPE === 'sqlite') {
            await sequelize.query('PRAGMA journal_mode = WAL');
            await sequelize.query('PRAGMA synchronous = NORMAL');
            await sequelize.query('PRAGMA cache_size = -64000');
            await sequelize.query('PRAGMA foreign_keys = ON');
            await sequelize.query('PRAGMA busy_timeout = 60000');  // 60 second timeout for busy database (increased from 30000)
            await sequelize.query('PRAGMA query_only = OFF');
            await sequelize.query('PRAGMA wal_autocheckpoint = 1000');  // Checkpoint after 1000 pages
            console.log('✅ SQLite WAL mode enabled for better concurrency');
            // For SQLite, use alter: false to avoid schema modification locks
            await sequelize.sync({ alter: false, force: false });
        } else {
            // For MySQL/PostgreSQL, alter: true will add missing columns
            console.log('🔄 Syncing database models with alter: true (will add missing columns)...');
            await sequelize.sync({ alter: true, force: false });
        }
        console.log('✅ Database models synchronized!');
        return true;
    } catch (error) {
        console.error(`❌ ${DB_TYPE.toUpperCase()} Connection Error:`, error.message);
        // Log full error details for debugging
        if (error.errors) {
            error.errors.forEach(e => console.error('  - Field Error:', e.message));
        }
        return false;
    }
};

const closeConnections = async () => {
    if (sequelize) {
        await sequelize.close();
        console.log(`⚠️  ${DB_TYPE.toUpperCase()} Database disconnected!`);
    }
};

module.exports = { sequelize, connectDatabase, closeConnections, DB_TYPE };
