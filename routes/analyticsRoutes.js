const express = require('express');
const router = express.Router();
const { getDashboardMetrics, getSalesAnalytics, getCustomerAnalytics, getProductAnalytics } = require('../controllers/analyticsController');
const { isAdminLoggedIn } = require('../middleware/authMiddleware');

// All analytics routes require admin authentication
router.use(isAdminLoggedIn);

// Dashboard metrics
router.get('/dashboard', getDashboardMetrics);

// Sales analytics
router.get('/sales', getSalesAnalytics);

// Customer analytics
router.get('/customers', getCustomerAnalytics);

// Product analytics
router.get('/products', getProductAnalytics);

module.exports = router;