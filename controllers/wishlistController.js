const sqlModels = require('../models/sql');

const wishlistController = {
    // Get user's wishlist
    getWishlist: async (req, res) => {
        try {
            const userId = req.user.id;
            
            // Find all wishlist items for the user with associated product data
            const wishlistItems = await sqlModels.Wishlist.findAll({
                where: { userId },
                include: [{
                    model: sqlModels.Product,
                    as: 'product',
                    attributes: ['id', 'name', 'price', 'discount', 'imageUrl']
                }],
                order: [['createdAt', 'DESC']]
            });

            res.json(wishlistItems);
        } catch (error) {
            console.error('Error fetching wishlist:', error);
            res.status(500).json({ message: 'Server error while fetching wishlist' });
        }
    },

    // Add product to wishlist
    addToWishlist: async (req, res) => {
        try {
            const userId = req.user.id;
            const { productId } = req.body;

            // Validate product exists
            const product = await sqlModels.Product.findByPk(productId);
            if (!product) {
                return res.status(404).json({ message: 'Product not found' });
            }

            // Check if product is already in wishlist
            const existingItem = await sqlModels.Wishlist.findOne({
                where: { userId, productId }
            });

            if (existingItem) {
                return res.status(400).json({ message: 'Product already in wishlist' });
            }

            // Add product to wishlist
            const wishlistItem = await sqlModels.Wishlist.create({
                userId,
                productId
            });

            res.status(201).json({ 
                message: 'Product added to wishlist', 
                wishlistItem 
            });
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            res.status(500).json({ message: 'Server error while adding to wishlist' });
        }
    },

    // Remove product from wishlist
    removeFromWishlist: async (req, res) => {
        try {
            const userId = req.user.id;
            const { productId } = req.params;

            // Remove the wishlist item
            const result = await sqlModels.Wishlist.destroy({
                where: { userId, productId }
            });

            if (result === 0) {
                return res.status(404).json({ message: 'Product not found in wishlist' });
            }

            res.json({ message: 'Product removed from wishlist' });
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            res.status(500).json({ message: 'Server error while removing from wishlist' });
        }
    },

    // Check if a product is in user's wishlist
    isProductInWishlist: async (req, res) => {
        try {
            const userId = req.user.id;
            const { productId } = req.params;

            const wishlistItem = await sqlModels.Wishlist.findOne({
                where: { userId, productId }
            });

            res.json({ inWishlist: !!wishlistItem });
        } catch (error) {
            console.error('Error checking wishlist status:', error);
            res.status(500).json({ message: 'Server error while checking wishlist status' });
        }
    }
};

module.exports = wishlistController;