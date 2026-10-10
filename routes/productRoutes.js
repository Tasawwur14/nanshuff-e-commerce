// server/routes/productRoutes.js

const express = require('express');
const router = express.Router();

// Controller functions import
const { 
    getAllProducts,
    getAllProductsForAdmin,
    getProductById,
    getFilterOptions,
    getFeaturedProducts,
    searchProducts,
    addProduct, 
    updateProduct, 
    deleteProduct 
} = require('../controllers/productController');

// Middleware import
const { isAdminLoggedIn } = require('../middleware/authMiddleware');
const uploadConfig = require('../middleware/upload');
const { validateCreateProduct, validateUpdateProduct, validateSearch, validatePagination, validateProductId } = require('../middleware/validationMiddleware');

// Use the configured upload middleware
const multipleUpload = uploadConfig.fields;

// === DEFINE ROUTES ===

// ADMIN ROUTE: GET /api/products/admin/all (Admin dashboard - no pagination)
router.get('/admin/all', isAdminLoggedIn, getAllProductsForAdmin);

// NAYA ROUTE: GET /api/products/search (Search products ke liye)
router.get('/search', validateSearch, searchProducts);

// NAYA ROUTE: GET /api/products/filters (Filter options laane ke liye)
router.get('/filters', getFilterOptions);

// NAYA ROUTE: GET /api/products/featured (Featured products ke liye)
router.get('/featured', getFeaturedProducts);

// POST /api/products/add (Admin) - Note: multipleUpload MUST come before validation
router.post('/add', isAdminLoggedIn, multipleUpload, validateCreateProduct, addProduct);

// PUT /api/products/update/:id (Admin) - Note: multipleUpload MUST come before validation
router.put('/update/:id', isAdminLoggedIn, multipleUpload, validateUpdateProduct, updateProduct);

// DELETE /api/products/delete/:id (Admin)
router.delete('/delete/:id', isAdminLoggedIn, validateProductId, deleteProduct);

// GET /api/products (Sabhi products + filtering ke liye)
router.get('/', validatePagination, getAllProducts);

// GET /api/products/:id (Single product ke liye) - MUST come last to avoid catching other routes
router.get('/:id', validateProductId, getProductById);

module.exports = router;