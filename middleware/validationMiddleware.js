const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors - return specific field errors, not generic message
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Build a detailed error object mapping field names to messages
        const errorMap = {};
        errors.array().forEach(err => {
            if (!errorMap[err.param]) {
                errorMap[err.param] = [];
            }
            errorMap[err.param].push(err.msg);
        });
        
        // Return first error message per field as the main message for checkout
        const firstError = errors.array()[0];
        return res.status(400).json({ 
            message: firstError.msg,  // Return specific field error message instead of generic "Validation error"
            field: firstError.param,  // Include the field name that failed
            errors: errorMap          // Include detailed error map for client to display all issues
        });
    }
    next();
};

// Auth validations
const validateSignup = [
    body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('email').trim().isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    handleValidationErrors
];

const validateLogin = [
    body('email').trim().isEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

const validateAdminLogin = [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

// Product validations - simplified for multipart FormData
const validateCreateProduct = [
    (req, res, next) => {
        console.log('✓ Product add request received, passing through to controller');
        next();
    }
];

const validateUpdateProduct = [
    param('id').isInt().withMessage('Invalid product ID'),
    body('name').optional().trim().isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
    body('mrp').optional().trim(),
    body('price').optional().trim(),
    body('discount').optional().trim(),
    body('stock').optional().trim(),
    body('category').optional().trim(),
    body('categoryId').optional(),
    body('sku').optional().trim(),
    body('weight').optional().trim(),
    body('short_description').optional().trim(),
    body('long_description').optional().trim(),
    body('ingredients').optional().trim(),
    body('how_to_use').optional().trim(),
    body('tags').optional().trim(),
    body('featured').optional(),
    body('status').optional().trim(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation error',
                errors: errors.array().map(err => ({ field: err.param, message: err.msg }))
            });
        }
        // Convert numeric strings to numbers for the controller
        if (req.body.mrp && req.body.mrp !== '') req.body.mrp = parseFloat(req.body.mrp) || req.body.mrp;
        if (req.body.price && req.body.price !== '') req.body.price = parseFloat(req.body.price) || req.body.price;
        if (req.body.discount && req.body.discount !== '') req.body.discount = parseFloat(req.body.discount) || req.body.discount;
        if (req.body.stock && req.body.stock !== '') req.body.stock = parseInt(req.body.stock, 10) || req.body.stock;
        next();
    }
];

// Cart validations
const validateAddToCart = [
    body('productId').isInt().withMessage('Invalid product ID'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be at least 0'),  // Allow 0 for removal
    handleValidationErrors
];

const validateUpdateCartItem = [
    param('itemId').isInt().withMessage('Invalid item ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    handleValidationErrors
];

// Order validations - required for guest checkouts, optional/validated if provided for logged in users
const validateCreateOrder = [
    body('fullName').custom((value, { req }) => {
        if (!req.user && (!value || !value.trim())) {
            throw new Error('Full name is required');
        }
        return true;
    }),
    body('email').custom((value, { req }) => {
        if (!req.user && (!value || !value.trim())) {
            throw new Error('Email is required');
        }
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error('Invalid email format');
        }
        return true;
    }),
    body('phone').custom((value, { req }) => {
        if (!req.user && (!value || !value.trim())) {
            throw new Error('Phone is required');
        }
        if (value && !/^[\d\s\+\-\(\)]{10,}$/.test(value)) {
            throw new Error('Invalid phone number');
        }
        return true;
    }),
    body('address').custom((value, { req }) => {
        if (!req.user && (!value || !value.trim())) {
            throw new Error('Address is required');
        }
        return true;
    }),
    body('city').custom((value, { req }) => {
        if (!req.user && (!value || !value.trim())) {
            throw new Error('City is required');
        }
        return true;
    }),
    body('state').custom((value, { req }) => {
        if (!req.user && (!value || !value.trim())) {
            throw new Error('State is required');
        }
        return true;
    }),
    body('postalCode').custom((value, { req }) => {
        if (!req.user && (!value || !value.trim())) {
            throw new Error('Postal code is required');
        }
        if (value && !/^\d{5,}$/.test(value)) {
            throw new Error('Invalid postal code');
        }
        return true;
    }),
    handleValidationErrors
];

// Coupon validations
const validateApplyCoupon = [
    body('code').trim().notEmpty().withMessage('Coupon code is required').isLength({ min: 3, max: 50 }).withMessage('Invalid coupon code format'),
    handleValidationErrors
];

// Category validations
const validateCreateCategory = [
    body('name').trim().notEmpty().withMessage('Category name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('slug').optional().trim().matches(/^[a-z0-9\-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
    handleValidationErrors
];

// ID param validation
const validateId = [
    param('id').isInt().withMessage('Invalid ID'),
    handleValidationErrors
];

const validateProductId = [
    param('id').isInt().withMessage('Invalid product ID'),
    handleValidationErrors
];

// Pagination query validation
const validatePagination = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    handleValidationErrors
];

// Search query validation
const validateSearch = [
    query('q').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters'),
    handleValidationErrors
];

module.exports = {
    validateSignup,
    validateLogin,
    validateAdminLogin,
    validateCreateProduct,
    validateUpdateProduct,
    validateAddToCart,
    validateUpdateCartItem,
    validateCreateOrder,
    validateApplyCoupon,
    validateCreateCategory,
    validateId,
    validateProductId,
    validatePagination,
    validateSearch,
    handleValidationErrors
};
