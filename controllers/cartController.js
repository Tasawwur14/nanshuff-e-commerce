const { DB_TYPE } = require('../config/database');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Helper to detect database connection errors in a DB-agnostic way
const isDbConnectionError = (err) => {
    if (!err) return false;
    const name = (err.name || '').toString();
    const msg = (err.message || '').toString();
    if (name.startsWith('Sequelize')) return true;
    if (/connection/i.test(name) || /connection/i.test(msg)) return true;
    if (/ECONNREFUSED|ENOTFOUND/i.test(msg)) return true;
    return false;
};

const getCart = async (req, res) => {
    if (req.user) {
        // User is logged in, get cart from DB
        try {
                // SQL mode: Cart is a Sequelize model with items stored as JSON
                const sqlCart = await Cart.findOne({ where: { userId: req.user.id } });
                if (!sqlCart) {
                    return res.json({ items: [], total: 0, discount: 0, finalTotal: 0 });
                }

                const items = sqlCart.items || [];
                let subtotal = 0;
                for (const item of items) {
                    // item.product is productId (int)
                    const product = await Product.findByPk(item.productId || item.product);
                    const price = product ? parseFloat(product.price) : parseFloat(item.price || 0);
                    subtotal += price * (item.quantity || 0);
                }

                const appliedDiscount = req.session.appliedDiscount || 0;
                const appliedCouponCode = req.session.appliedCouponCode || null;
                const discountAmount = subtotal * (appliedDiscount / 100);
                const finalTotal = subtotal - discountAmount;

                return res.json({ 
                    items, 
                    subtotal: parseFloat(subtotal.toFixed(2)), 
                    discount: parseFloat(discountAmount.toFixed(2)), 
                    discountPercentage: appliedDiscount,
                    appliedCouponCode: appliedCouponCode,
                    finalTotal: parseFloat(finalTotal.toFixed(2))
                });
        } catch (error) {
            console.error('Error fetching cart:', error);
            // If it looks like a DB connection error, return 503
            if (isDbConnectionError(error)) {
                return res.status(503).json({ 
                    message: "Database connection error - please try again later",
                    error: error.message 
                });
            }
            res.status(500).json({ message: 'Server Error', error: error.message });
        }
    } else {
        // User is not logged in, get cart from session
        console.log('Getting cart from session...');
        console.log('Session ID:', req.sessionID);
        console.log('Session cart:', JSON.stringify(req.session.cart, null, 2));
        
        const sessionCart = req.session.cart || { items: [] };
        
        // Calculate subtotal for session cart
        let subtotal = 0;
        if (sessionCart.items) {
            sessionCart.items.forEach(item => {
                const price = parseFloat(item.price) || 0;
                const quantity = parseInt(item.quantity) || 0;
                subtotal += price * quantity;
            });
        }
        
        // Check for applied discount in session (if any)
        const appliedDiscount = req.session.appliedDiscount || 0;
        const appliedCouponCode = req.session.appliedCouponCode || null;
        const discountAmount = subtotal * (appliedDiscount / 100);
        const finalTotal = subtotal - discountAmount;
        
        res.json({ 
            items: sessionCart.items || [], 
            subtotal: parseFloat(subtotal.toFixed(2)), 
            discount: parseFloat(discountAmount.toFixed(2)), 
            discountPercentage: appliedDiscount,
            appliedCouponCode: appliedCouponCode,
            finalTotal: parseFloat(finalTotal.toFixed(2))
        });
    }
};

const addToCart = async (req, res) => {
    const { productId, quantity } = req.body;

        try {
        // Validate input
        if (!productId || typeof quantity === 'undefined') {
            return res.status(400).json({ message: 'Product ID and quantity are required' });
        }

        const parsedQuantity = parseInt(quantity);
        if (isNaN(parsedQuantity) || parsedQuantity < 0 || parsedQuantity > 100) { // Max 100 per item, allow 0 for removal
            return res.status(400).json({ message: 'Invalid quantity. Must be between 1 and 100.' });
        }

        let product;
            // For SQL, productId expected to be integer or string id
            product = await Product.findByPk(productId);
            if (!product) return res.status(404).json({ message: 'Product not found' });



        if (req.user) {
            // User is logged in, update DB cart
            if (DB_TYPE === 'mysql' || DB_TYPE === 'postgresql' || DB_TYPE === 'sqlite') {
                // SQL mode: find or create cart by userId
                let sqlCart = await Cart.findOne({ where: { userId: req.user.id } });
                if (sqlCart) {
                    const items = sqlCart.items || [];
                    if (parsedQuantity === 0) {
                        // If quantity is 0, remove the item from cart
                        const itemIndex = items.findIndex(p => String(p.productId || p.product) === String(productId));
                        if (itemIndex > -1) {
                            items.splice(itemIndex, 1);
                        }
                    } else {
                        const itemIndex = items.findIndex(p => String(p.productId || p.product) === String(productId));
                        if (itemIndex > -1) {
                            items[itemIndex].quantity = parsedQuantity;
                        } else {
                            items.push({ productId: productId, quantity: parsedQuantity, price: product.price, name: product.name, imageUrl: product.imageUrl });
                        }
                    }
                    sqlCart.items = items;
                    await sqlCart.save();
                } else if (parsedQuantity > 0) {
                    // Only create a new cart if quantity > 0
                    sqlCart = await Cart.create({ userId: req.user.id, items: [{ productId: productId, quantity: parsedQuantity, price: product.price, name: product.name, imageUrl: product.imageUrl }] });
                }
                return res.status(201).json(sqlCart);
            } else {
                let cart = await Cart.findOne({ user: req.user.id });
                if (cart) {
                    const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);
                    if (parsedQuantity === 0) {
                        // If quantity is 0, remove the item from cart
                        if (itemIndex > -1) {
                            cart.items.splice(itemIndex, 1);
                        }
                    } else if (itemIndex > -1) {
                        cart.items[itemIndex].quantity = parsedQuantity;
                    } else {
                        cart.items.push({ product: productId, quantity: parsedQuantity });
                    }
                } else if (parsedQuantity > 0) {
                    // Only create a new cart if quantity > 0
                    cart = new Cart({
                        user: req.user.id,
                        items: [{ product: productId, quantity: parsedQuantity }]
                    });
                }
                await cart.save();
                res.status(201).json(cart);
            }
        } else {
            // User is not logged in, update session cart
            if (!req.session.cart) {
                req.session.cart = { items: [] };
            }
            
            // For guest users, always use the current product price
            const itemIndex = req.session.cart.items.findIndex(p => p.product === productId);
            if (parsedQuantity === 0) {
                // If quantity is 0, remove the item from cart
                if (itemIndex > -1) {
                    req.session.cart.items.splice(itemIndex, 1);
                }
            } else if (itemIndex > -1) {
                req.session.cart.items[itemIndex].quantity = parsedQuantity;
                // Update price to current value to prevent price manipulation
                req.session.cart.items[itemIndex].price = product.price;
                // Also update other product details in case they changed
                req.session.cart.items[itemIndex].name = product.name;
                req.session.cart.items[itemIndex].imageUrl = product.imageUrl;
            } else {
                req.session.cart.items.push({ 
                    product: productId, 
                    quantity: parsedQuantity, 
                    name: product.name, 
                    price: product.price,  // Current price to prevent manipulation
                    imageUrl: product.imageUrl 
                });
            }
            
            // Debug logging
            console.log('Session cart after add:', JSON.stringify(req.session.cart, null, 2));
            console.log('Session ID:', req.sessionID);
            
            // Explicitly save session
            req.session.save((err) => {
                if (err) {
                    console.error('Error saving session:', err);
                    return res.status(500).json({ message: 'Error saving cart to session' });
                }
                console.log('Session saved successfully');
                res.status(201).json(req.session.cart);
            });
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        // Check if it's a database connection error
        if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
            return res.status(503).json({ 
                message: "Database connection error - please try again later",
                error: error.message 
            });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const removeFromCart = async (req, res) => {
    const { productId } = req.params;

    if (req.user) {
        // User is logged in, remove from DB cart
        try {
                const cart = await Cart.findOne({ where: { userId: req.user.id } });
                if (cart) {
                cart.items = cart.items.filter(p => String(p.productId || p.product) !== String(productId));
                await cart.save();
            }
            res.json(cart);
        } catch (error) {
            console.error('Error removing from cart:', error);
            if (isDbConnectionError(error)) {
                return res.status(503).json({ 
                    message: "Database connection error - please try again later",
                    error: error.message 
                });
            }
            res.status(500).json({ message: 'Server Error', error: error.message });
        }
    } else {
        // User is not logged in, remove from session cart
        if (req.session.cart) {
            req.session.cart.items = req.session.cart.items.filter(p => p.product !== productId);
        }
        res.json(req.session.cart);
    }
};

// Set discount in session
const setDiscount = async (req, res) => {
    if (req.user) {
        // For logged-in users, we can store discount in a temporary session
        req.session.appliedDiscount = req.body.discountPercentage || 0;
        req.session.appliedCouponCode = req.body.code || null;
    } else {
        // For guest users, store discount in session
        req.session.appliedDiscount = req.body.discountPercentage || 0;
        req.session.appliedCouponCode = req.body.code || null;
    }
    
    res.json({ success: true, discount: req.session.appliedDiscount, code: req.session.appliedCouponCode });
};

module.exports = { getCart, addToCart, removeFromCart, setDiscount };