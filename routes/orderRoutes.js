const express = require('express');
const router = express.Router();
const { createOrder, codConfirm, getAllOrders, getOrderById, updateOrderStatus, getUserOrders } = require('../controllers/orderController');
const { isLoggedIn, optionalAuth } = require('../middleware/authMiddleware');
const { isAdminLoggedIn } = require('../middleware/authMiddleware'); // For admin order management
const { validateCreateOrder, validateId, validatePagination } = require('../middleware/validationMiddleware');

// Public route for creating orders (allows both authenticated users and guests)
router.post('/', optionalAuth, validateCreateOrder, createOrder);

// Alias for create endpoint (also allows guests)
router.post('/create', optionalAuth, validateCreateOrder, createOrder);

// COD (Cash On Delivery) confirmation endpoint (allows both authenticated and guest users)
router.post('/cod-confirm', optionalAuth, codConfirm);

// Get orders for the logged-in user (user route - no admin login required)
router.get('/myorders', isLoggedIn, getUserOrders);

// PUBLIC: Get a single order by ID (accessible to user who owns it, admins, or guests viewing their order)
// IMPORTANT: This route MUST be AFTER /myorders to avoid route conflicts
// IMPORTANT: This route MUST be BEFORE the admin middleware to allow non-admins to access
router.get('/:id', validateId, optionalAuth, getOrderById);

// ===== ADMIN-ONLY ROUTES BELOW =====
// Apply admin auth middleware to all routes below
router.use(isAdminLoggedIn);

// Get all orders with optional filters (admin only)
router.get('/', validatePagination, getAllOrders);

// Update order status (admin only)
router.put('/:id', validateId, updateOrderStatus);

module.exports = router;
