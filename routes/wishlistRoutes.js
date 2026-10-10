const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { isLoggedIn } = require('../middleware/authMiddleware');

// Get user's wishlist
router.get('/wishlist', isLoggedIn, wishlistController.getWishlist);

// Add product to wishlist
router.post('/wishlist', isLoggedIn, wishlistController.addToWishlist);

// Remove product from wishlist
router.delete('/wishlist/:productId', isLoggedIn, wishlistController.removeFromWishlist);

// Check if product is in wishlist
router.get('/wishlist/:productId', isLoggedIn, wishlistController.isProductInWishlist);

module.exports = router;