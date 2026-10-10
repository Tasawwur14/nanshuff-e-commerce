
const express = require('express');
const router = express.Router();
const { addCoupon, getAllCoupons, updateCoupon, deleteCoupon, validateCoupon } = require('../controllers/couponController');
const { isAdminLoggedIn } = require('../middleware/authMiddleware');

// Public validation route (no authentication required)
router.get('/validate', validateCoupon);

// Admin routes (require authentication)
router.get('/', isAdminLoggedIn, getAllCoupons);
router.post('/', isAdminLoggedIn, addCoupon);
router.put('/:id', isAdminLoggedIn, updateCoupon);
router.delete('/:id', isAdminLoggedIn, deleteCoupon);

module.exports = router;
