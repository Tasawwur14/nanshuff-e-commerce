const express = require('express');
const router = express.Router();
const { getCart, addToCart, removeFromCart, setDiscount } = require('../controllers/cartController');
const { isLoggedIn } = require('../middleware/authMiddleware');
const { validateAddToCart, validateProductId } = require('../middleware/validationMiddleware');

// Allow anonymous users to get and add to cart (session-based)
router.route('/').get(getCart).post(validateAddToCart, addToCart);
// Allow anonymous users to remove from cart and apply discounts
router.route('/:productId').delete(isLoggedIn, validateProductId, removeFromCart);
router.route('/discount').post(setDiscount);

module.exports = router;
