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

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch user using appropriate model API depending on DB type
            // Sequelize: findByPk and exclude password via attributes
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
    }

    // If we reach here, no token was provided
    return res.status(401).json({ message: 'Not authorized, no token' });
};

exports.isAdminLoggedIn = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Check if the user has the admin role
            if (decoded.role !== 'admin') {
                res.status(401).json({ message: 'Not authorized, not an admin' });
                return; // stop further execution
            }

            // Fetch the actual admin user from DB using appropriate API
            // Sequelize: find admin by PK and exclude password
            const admin = await Admin.findByPk(decoded.id, { attributes: { exclude: ['password'] } });

            if (!admin) {
                res.status(401).json({ message: 'Not authorized, admin not found' });
                return; // stop further execution
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
