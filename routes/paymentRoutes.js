const express = require('express');
const router = express.Router();
const { processFakePayment, createRazorpayOrder, verifyRazorpayPayment, getPaymentStatus, cancelOrderIfPaymentNotCompleted } = require('../controllers/paymentController');
const { isLoggedIn, optionalAuth } = require('../middleware/authMiddleware');

// Process fake payment (requires user to be logged in)
router.post('/process', isLoggedIn, processFakePayment);

// Razorpay Payment Routes (allow guest checkout with optionalAuth)
router.post('/razorpay/create-order', optionalAuth, createRazorpayOrder);
router.post('/razorpay/verify', optionalAuth, verifyRazorpayPayment);

// Get payment status (allow guest checkout with optionalAuth)
router.get('/status/:orderId', optionalAuth, getPaymentStatus);

// Cancel order if payment not completed (allow guest checkout with optionalAuth)
router.post('/cancel-order/:orderId', optionalAuth, cancelOrderIfPaymentNotCompleted);

module.exports = router;