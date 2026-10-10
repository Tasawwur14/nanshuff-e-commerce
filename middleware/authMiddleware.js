const jwt = require('jsonwebtoken');
const { DB_TYPE } = require('../config/database');

// Use SQL models via the centralized sql index
const sqlModels = require('../models/sql');
const User = sqlModels.User;
const Admin = sqlModels.Admin;

exports.isLoggedIn = async (req, res, next) => {
    let token;
    // Prefer Authorization header, fallback to cookie named 'token'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (token && typeof token === 'string') {
        token = token.trim();
        if (token.startsWith('Bearer ')) {
            token = token.slice(7).trim();
        }
        if (token.startsWith('"') && token.endsWith('"')) {
            token = token.slice(1, -1);
        }
    }

    if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user using appropriate model API depending on DB type
        const userRecord = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
        req.user = userRecord || null;

        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }
        return next();
    } catch (error) {
        console.error('JWT Verification Error:', error && error.message ? error.message : error);
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'TokenExpiredError: token has expired' });
        }
        return res.status(401).json({ message: 'InvalidTokenError: token verification failed' });
    }
};

exports.isAdminLoggedIn = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.adminToken) {
        token = req.cookies.adminToken;
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (token && typeof token === 'string') {
        token = token.trim();
        if (token.startsWith('Bearer ')) {
            token = token.slice(7).trim();
        }
        if (token.startsWith('"') && token.endsWith('"')) {
            token = token.slice(1, -1);
        }
    }

    if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if the user has the admin role
        if (decoded.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized, not an admin' });
        }

        // Fetch the actual admin user from DB using appropriate API
        const admin = await Admin.findByPk(decoded.id, { attributes: { exclude: ['password'] } });

        if (!admin) {
            return res.status(401).json({ message: 'Not authorized, admin not found' });
        }

        req.admin = admin; // Set the actual admin document
        return next();
    } catch (error) {
        console.error('JWT Verification Error (Admin):', error && error.message ? error.message : error);
        if (error && error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'TokenExpiredError: token has expired' });
        }
        return res.status(401).json({ message: 'InvalidTokenError: token verification failed' });
    }
};

// Optional authentication middleware - allows both authenticated and guest users
// Used for order creation to support guest checkout
exports.optionalAuth = async (req, res, next) => {
    let token;
    // Prefer Authorization header, fallback to cookie named 'token'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userRecord = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
            if (userRecord) {
                req.user = userRecord;
                console.log('✅ Authenticated user:', userRecord.id, userRecord.email);
            } else {
                console.log('⚠️  Token provided but user not found in DB, allowing as guest');
                req.user = null;
            }
        } catch (error) {
            console.log('⚠️  Token verification failed:', error.message, '- allowing as guest');
            req.user = null;
        }
    } else {
        console.log('✅ No token provided - allowing guest checkout');
        req.user = null;
    }

    // Always continue, whether authenticated or guest
    return next();
};
