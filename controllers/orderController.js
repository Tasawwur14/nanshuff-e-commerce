const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Cart = require('../models/Cart');
const sqlModels = require('../models/sql');
const User = sqlModels.User;
const { sendOrderConfirmation } = require('../utils/emailService');
const jwt = require('jsonwebtoken');

const createOrder = async (req, res) => {
    const { couponCode, fullName, email, phone, address, city, state, postalCode, country } = req.body;
    
    try {
        console.log('\n' + '='.repeat(60));
        console.log('🔵 ORDER CREATE REQUEST');
        console.log('='.repeat(60));
        console.log('📍 Timestamp:', new Date().toISOString());
        
        const userId = req.user ? req.user.id : null;
        const isGuest = !userId;
        
        if (isGuest) {
            console.log('✅ Guest checkout request detected');
            if (!fullName || !email || !phone || !address) {
                return res.status(400).json({ message: 'Guest checkout requires: fullName, email, phone, address' });
            }
        } else {
            console.log('✅ Authenticated user checkout: ID=' + userId);
        }

        console.log('\n📊 CART RETRIEVAL:');
        let cartItems = [];
    
        if (userId) {
            // For authenticated users, we can still check the database cart
            const sqlCart = await Cart.findOne({ where: { userId } });
            console.log('  Database cart found:', !!sqlCart);
            cartItems = sqlCart?.items || [];
            
            if ((!cartItems || cartItems.length === 0) && req.session?.cart?.items) {
                console.log('  ⚠️  Using session cart');
                cartItems = req.session.cart.items;
            }
        } else {
            // For guest users, first check if cartItems were explicitly provided in the request
            if (req.body.cartItems !== undefined) {
                // cartItems were explicitly provided in request body (even if empty array [])
                console.log('  ✅ Guest cart items from request (explicitly provided, length: ' + req.body.cartItems.length + ')');
                cartItems = req.body.cartItems; // Use req.body.cartItems directly instead of guestCartItems alias
            } else if (req.session?.cart?.items && req.session.cart.items.length > 0) {
                // Fall back to session cart if no cartItems provided in request
                console.log('  ⚠️  Using session cart for guest');
                cartItems = req.session.cart.items;
            } else {
                return res.status(400).json({ message: 'Cart is empty' });
            }
        }
        
        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }
        
        console.log('✅ Cart has ' + cartItems.length + ' item(s)');

        let subtotal = 0;
        let discountAmount = 0;
        let discountPercentage = 0;
        const orderItems = [];

        // Start transaction AFTER data validation - minimize lock time
        const t = await sequelize.transaction({
            isolationLevel: 'READ COMMITTED'
        });

        try {
            console.log('\n💰 PROCESSING ITEMS:');
            for (const item of cartItems) {
                const product = await Product.findByPk(item.productId || item.product, { transaction: t, lock: t.LOCK.UPDATE });
                if (!product) {
                    throw new Error('Product with ID ' + (item.productId || item.product) + ' not found');
                }

                const quantityToProcess = item.quantity || 0;
                if (product.stock < quantityToProcess) {
                    throw new Error('Not enough stock for ' + product.name + '. Only ' + product.stock + ' available.');
                }

                const currentProductPrice = parseFloat(product.price || 0);
                subtotal += currentProductPrice * quantityToProcess;
                orderItems.push({ productId: product.id, quantity: quantityToProcess, price: currentProductPrice });
                
                console.log('  ✅ ' + product.name + ': qty=' + quantityToProcess + ', price=₹' + currentProductPrice);

                product.stock -= quantityToProcess;
                await product.save({ transaction: t });
            }
            
            console.log('\n💵 SUBTOTAL: ₹' + subtotal);

            let totalAmount = subtotal;
            if (couponCode) {
                console.log('\n🎟️  COUPON PROCESSING:');
                const appliedCoupon = await Coupon.findOne({ where: { code: couponCode }, transaction: t });
                if (appliedCoupon) {
                    if (appliedCoupon.expiryDate && new Date(appliedCoupon.expiryDate) < new Date()) {
                        throw new Error('Coupon has expired');
                    }
                    discountPercentage = appliedCoupon.discountValue || appliedCoupon.discount || 0;
                    const maxDiscountPercent = 90;
                    if (discountPercentage > maxDiscountPercent || discountPercentage < 0) {
                        throw new Error('Invalid discount percentage: ' + discountPercentage + '%');
                    }
                    discountAmount = subtotal * (discountPercentage / 100);
                    totalAmount = subtotal - discountAmount;
                    appliedCoupon.usedCount = (appliedCoupon.usedCount || 0) + 1;
                    await appliedCoupon.save({ transaction: t });
                    console.log('  ✅ Coupon applied: ' + discountPercentage + '%');
                }
            }
            
            console.log('  TOTAL AFTER DISCOUNT: ₹' + totalAmount);

            const orderNumber = 'ORD-' + Date.now() + '-' + (Math.floor(Math.random() * 9000) + 1000);
            const shippingAddress = {
                fullName: fullName || (req.user?.name) || 'N/A',
                email: email || (req.user?.email) || 'N/A',
                phone: phone || 'N/A',
                address: address || 'N/A',
                city: city || 'N/A',
                state: state || 'N/A',
                postalCode: postalCode || 'N/A',
                country: country || 'India'
            };

            console.log('\n📋 ORDER DETAILS:');
            console.log('  Order Number: ' + orderNumber);
            console.log('  Total Amount: ₹' + totalAmount);
            console.log('  Order Type: ' + (isGuest ? 'GUEST' : 'AUTHENTICATED'));

            const sqlOrder = await Order.create({ 
                userId: userId, 
                items: orderItems, 
                totalAmount,
                subtotal,
                discountAmount,
                discountPercentage,
                coupon: couponCode, 
                orderNumber, 
                shippingAddress,
                status: 'pending',
                paymentStatus: 'pending'
            }, { transaction: t });

            console.log('  ✅ Order created with ID: ' + sqlOrder.id);

            if (userId) {
                await Cart.destroy({ where: { userId }, transaction: t });
                console.log('  ✅ Cart cleared for user');
            } else {
                if (req.session.cart) {
                    req.session.cart = { items: [], total: 0 };
                    console.log('  ℹ️  Guest session cart cleared');
                }
            }

            await t.commit();
            console.log('✅ TRANSACTION COMMITTED\n');
            
            const orderData = {
                orderNumber: sqlOrder.orderNumber,
                customerName: fullName || (req.user?.name) || 'Guest',
                email: email || (req.user?.email),
                items: orderItems,
                total: totalAmount
            };
            
            if (orderData.email) {
                sendOrderConfirmation(orderData.email, orderData).catch(err => 
                    console.error('Email sending failed:', err.message)
                );
            }

            return res.status(201).json({ 
                orderId: sqlOrder.id,
                message: 'Order placed successfully',
                order: sqlOrder
            });
        } catch (txnError) {
            await t.rollback();
            throw txnError;  // Re-throw to outer catch
        }
    } catch (error) {
        console.error('\n❌ ERROR CREATING ORDER:', error.message);
        return res.status(500).json({ message: error.message || 'Error creating order' });
    }
};

const codConfirm = async (req, res) => {
    try {
        const { orderId, paymentMethod } = req.body;
        const userId = req.user?.id;

        if (!orderId) {
            return res.status(400).json({ message: 'Order ID is required' });
        }

        if (paymentMethod !== 'cod') {
            return res.status(400).json({ message: 'Invalid payment method' });
        }

        // Find the order by ID only (not by userId) to allow for guest orders
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // If the order belongs to a logged-in user, make sure it matches the current user
        if (order.userId && userId && order.userId !== userId) {
            return res.status(403).json({ message: 'You do not have permission to access this order' });
        }

        // For guest orders (order.userId is null), the user doesn't need to be authenticated
        // For logged-in users, ensure they are authenticated
        if (order.userId && !userId) {
            return res.status(401).json({ message: 'Authentication required for this order' });
        }

        order.paymentMethod = 'cod';
        order.paymentStatus = 'pending';
        order.status = 'pending';
        await order.save();

        // Only clear cart for authenticated users
        if (userId) {
            await Cart.destroy({ where: { userId } });
        }

        if (req.session?.cart) {
            req.session.cart = { items: [], total: 0 };
        }
        
        // Send confirmation email based on order's shipping address
        const shippingInfo = order.shippingAddress;
        sendOrderConfirmation(shippingInfo.email, {
            orderNumber: order.orderNumber,
            customerName: shippingInfo.fullName || 'Guest',
            email: shippingInfo.email,
            items: order.items,
            total: order.totalAmount
        }).catch(err => console.error('Email failed:', err.message));

        return res.status(200).json({
            success: true,
            message: 'COD order confirmed successfully',
            orderId: order.id,
            orderNumber: order.orderNumber
        });
    } catch (error) {
        console.error('Error confirming COD order:', error);
        return res.status(500).json({ message: 'Failed to confirm COD order', error: error.message });
    }
};

const getAllOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        
        const where = {};
        if (status) where.status = status;

        const offset = (page - 1) * limit;

        const orders = await Order.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
            include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
        });

        const total = await Order.count({ where });

        // Convert DECIMAL fields to numbers (fixes SQLite returning strings)
        const formattedOrders = await Promise.all(orders.map(async (order) => {
            const orderData = order.get({ plain: true });
            
            // CRITICAL FIX: Parse shippingAddress if it's a JSON string (production DB issue)
            let shippingAddress = orderData.shippingAddress;
            if (typeof shippingAddress === 'string') {
                try {
                    shippingAddress = JSON.parse(shippingAddress);
                } catch (e) {
                    console.error('Failed to parse shippingAddress for order', orderData.id, e);
                    shippingAddress = null;
                }
            }
            
            // CRITICAL FIX: Parse items if it's a JSON string (production DB issue)
            let items = orderData.items;
            if (typeof items === 'string') {
                try {
                    items = JSON.parse(items);
                } catch (e) {
                    console.error('Failed to parse items for order', orderData.id, e);
                    items = [];
                }
            }
            // Ensure items is always an array
            if (!Array.isArray(items)) {
                items = [];
            }
            
            const formattedOrder = {
                ...orderData,
                items: items, // Use parsed version
                shippingAddress: shippingAddress, // Use parsed version
                totalAmount: Number(orderData.totalAmount),
                subtotal: Number(orderData.subtotal),
                discountAmount: Number(orderData.discountAmount),
                discountPercentage: Number(orderData.discountPercentage),
                coupon: orderData.coupon // Ensure coupon field is preserved
            };
            
            // Populate product details for each item in the order
            if (formattedOrder.items && Array.isArray(formattedOrder.items)) {
                // Fetch all products in parallel for better performance
                const productPromises = formattedOrder.items.map(async (item) => {
                    if (item.productId) {
                        try {
                            const product = await Product.findByPk(item.productId);
                            if (product) {
                                // Add product details to the item
                                item.product = {
                                    id: product.id,
                                    name: product.name,
                                    price: product.price,
                                    imageUrl: product.imageUrl
                                };
                            }
                        } catch (error) {
                            console.error('Error fetching product for order item:', error);
                            // If there's an error fetching the product, leave the item as is
                        }
                    }
                    return item;
                });
                
                // Wait for all product fetches to complete
                formattedOrder.items = await Promise.all(productPromises);
            }
            
            return formattedOrder;
        }));

        res.json({
            orders: formattedOrders,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalOrders: total
            }
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Server error while fetching orders' });
    }
};

const getOrderById = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
        });
        if (!order) return res.status(404).json({ message: 'Order not found' });
        
        // Authorization check:
        // 1. If user is authenticated, they can only view their own orders
        // 2. If admin (via req.admin), they can view any order
        // 3. If order is a guest order (no userId), allow viewing (for order confirmation page)
        const userId = req.user?.id;
        let isAdmin = !!req.admin?.id;
        
        // CRITICAL FIX: For admin dashboard requests that come through optionalAuth,
        // check the JWT token directly for admin role
        if (!isAdmin && req.headers.authorization) {
            try {
                const token = req.headers.authorization.startsWith('Bearer') 
                    ? req.headers.authorization.split(' ')[1] 
                    : req.cookies?.token;
                    
                if (token) {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    isAdmin = decoded.role === 'admin';
                }
            } catch (error) {
                // Token verification failed, continue with isAdmin = false
                console.log('Token verification failed in getOrderById:', error.message);
            }
        }
        
        if (order.userId && userId !== order.userId && !isAdmin) {
            return res.status(403).json({ message: 'You do not have permission to view this order' });
        }
        
        // Convert DECIMAL fields to numbers (fixes SQLite returning strings)
        const orderData = order.get({ plain: true });
        
        // CRITICAL FIX: Parse shippingAddress if it's a JSON string (production DB issue)
        let shippingAddress = orderData.shippingAddress;
        if (typeof shippingAddress === 'string') {
            try {
                shippingAddress = JSON.parse(shippingAddress);
            } catch (e) {
                console.error('Failed to parse shippingAddress for order', orderData.id, e);
                shippingAddress = null;
            }
        }
        
        // CRITICAL FIX: Parse items if it's a JSON string (production DB issue)
        let items = orderData.items;
        if (typeof items === 'string') {
            try {
                items = JSON.parse(items);
            } catch (e) {
                console.error('Failed to parse items for order', orderData.id, e);
                items = [];
            }
        }
        // Ensure items is always an array
        if (!Array.isArray(items)) {
            items = [];
        }
        
        const formattedOrder = {
            ...orderData,
            items: items, // Use parsed version
            shippingAddress: shippingAddress, // Use parsed version
            totalAmount: Number(orderData.totalAmount),
            subtotal: Number(orderData.subtotal),
            discountAmount: Number(orderData.discountAmount),
            discountPercentage: Number(orderData.discountPercentage),
            coupon: orderData.coupon // Ensure coupon field is preserved
        };
        
        // Populate product details for each item in the order
        if (formattedOrder.items && Array.isArray(formattedOrder.items)) {
            // Fetch all products in parallel for better performance
            const productPromises = formattedOrder.items.map(async (item) => {
                if (item.productId) {
                    try {
                        const product = await Product.findByPk(item.productId);
                        if (product) {
                            // Add product details to the item
                            item.product = {
                                id: product.id,
                                name: product.name,
                                price: product.price,
                                imageUrl: product.imageUrl
                            };
                        }
                    } catch (error) {
                        console.error('Error fetching product for order item:', error);
                        // If there's an error fetching the product, leave the item as is
                    }
                }
                return item;
            });
            
            // Wait for all product fetches to complete
            formattedOrder.items = await Promise.all(productPromises);
        }
        
        res.json(formattedOrder);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ message: 'Server error while fetching order' });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        
        const validStatuses = ['pending', 'Payment Pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        const normalizedStatus = status.toLowerCase();
        if (!validStatuses.includes(normalizedStatus)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Map the normalized status to the proper format for saving
        const statusToSave = normalizedStatus === 'payment pending' ? 'Payment Pending' : status;
        order.status = statusToSave;
        await order.save();

        res.json({ message: 'Order status updated successfully', order });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error while updating order status' });
    }
};

const getUserOrders = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const orders = await Order.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']],
            include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
        });

        // Convert DECIMAL fields to numbers (fixes SQLite returning strings)
        const formattedOrders = await Promise.all(orders.map(async (order) => {
            const orderData = order.get({ plain: true });
            
            // CRITICAL FIX: Parse shippingAddress if it's a JSON string (production DB issue)
            let shippingAddress = orderData.shippingAddress;
            if (typeof shippingAddress === 'string') {
                try {
                    shippingAddress = JSON.parse(shippingAddress);
                } catch (e) {
                    console.error('Failed to parse shippingAddress for order', orderData.id, e);
                    shippingAddress = null;
                }
            }
            
            // CRITICAL FIX: Parse items if it's a JSON string (production DB issue)
            let items = orderData.items;
            if (typeof items === 'string') {
                try {
                    items = JSON.parse(items);
                } catch (e) {
                    console.error('Failed to parse items for order', orderData.id, e);
                    items = [];
                }
            }
            // Ensure items is always an array
            if (!Array.isArray(items)) {
                items = [];
            }
            
            const formattedOrder = {
                ...orderData,
                items: items, // Use parsed version
                shippingAddress: shippingAddress, // Use parsed version
                totalAmount: Number(orderData.totalAmount),
                subtotal: Number(orderData.subtotal),
                discountAmount: Number(orderData.discountAmount),
                discountPercentage: Number(orderData.discountPercentage),
                coupon: orderData.coupon // Ensure coupon field is preserved
            };
            
            // Populate product details for each item in the order
            if (formattedOrder.items && Array.isArray(formattedOrder.items)) {
                // Fetch all products in parallel for better performance
                const productPromises = formattedOrder.items.map(async (item) => {
                    if (item.productId) {
                        try {
                            const product = await Product.findByPk(item.productId);
                            if (product) {
                                // Add product details to the item
                                item.product = {
                                    id: product.id,
                                    name: product.name,
                                    price: product.price,
                                    imageUrl: product.imageUrl
                                };
                            }
                        } catch (error) {
                            console.error('Error fetching product for order item:', error);
                            // If there's an error fetching the product, leave the item as is
                        }
                    }
                    return item;
                });
                
                // Wait for all product fetches to complete
                formattedOrder.items = await Promise.all(productPromises);
            }
            
            return formattedOrder;
        }));

        res.json({ orders: formattedOrders });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ message: 'Server error while fetching user orders' });
    }
};

module.exports = { createOrder, codConfirm, getAllOrders, getOrderById, updateOrderStatus, getUserOrders };
