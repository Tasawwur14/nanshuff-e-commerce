const sqlModels = require('../models/sql');
const { Op } = require('sequelize');
const Order = sqlModels.Order;
const crypto = require('crypto');

// Process Razorpay payment
exports.processFakePayment = async (req, res) => {
    try {
        const { orderId, paymentDetails } = req.body;
        
        // Validate required fields
        if (!orderId) {
            return res.status(400).json({ message: 'Order ID is required' });
        }
        
        // Verify the order exists
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Simulate payment processing delay (to mimic real API call)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Randomly determine if payment is successful (95% success rate for testing)
        const paymentSuccessful = Math.random() > 0.05; // 95% success rate
        
        if (paymentSuccessful) {
            // Update order status to reflect payment
            order.status = 'Processing';
            order.paymentId = `FAKE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`; // Generate fake payment ID
            await order.save();

            res.status(200).json({
                success: true,
                message: 'Payment processed successfully',
                orderId: order.id,
                paymentId: order.paymentId,
                amount: order.totalAmount,
                status: 'captured'
            });
        } else {
            // Simulate a payment failure
            res.status(400).json({
                success: false,
                message: 'Payment failed. Please try again.',
                orderId: order.id,
                error: 'Fake payment gateway declined transaction'
            });
        }
    } catch (error) {
        console.error('Error processing fake payment:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during payment processing',
            error: error.message
        });
    }
};

// Create Razorpay order
exports.createRazorpayOrder = async (req, res) => {
    try {
        const { orderId, amount, currency = 'INR' } = req.body;
        
        if (!orderId || !amount) {
            return res.status(400).json({ message: 'Order ID and amount are required' });
        }
        
        // Ensure amount is a valid number and convert to integer (required by Razorpay)
        const amountInPaise = Math.round(parseFloat(amount) * 100);
        if (isNaN(amountInPaise) || amountInPaise <= 0) {
            return res.status(400).json({ message: 'Invalid amount provided' });
        }
        
        // Verify the order exists
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Update order status to indicate payment processing has started
        order.status = 'Payment Pending';
        await order.save();
        
        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise, // Razorpay expects amount in paise as an integer
            currency,
            receipt: orderId.toString(),
            payment_capture: 1
        });
        
        
        // In a real implementation, you would use the actual Razorpay response
        // For our mock implementation, we'll use the real razorpayOrder that was created above
        
        // Store Razorpay order ID in our database for verification later
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();
        
        res.status(200).json({
            success: true,
            orderId: razorpayOrder.id,
            amount: amountInPaise,  // Send the amount that was sent to Razorpay
            currency: razorpayOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key'
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating payment order',
            error: error.message,
            ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
        });
    }
};

// Verify Razorpay payment
exports.verifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
        
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing payment verification parameters' });
        }
        
        // Verify the order exists
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
       
        // In a mock environment, we'll skip signature verification
        // In production, the signature verification should be kept
        const isSignatureValid = process.env.NODE_ENV === 'production' 
            ? (() => {
                const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
                const expectedSignature = crypto
                    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                    .update(payload)
                    .digest('hex');
                return expectedSignature === razorpay_signature;
            })()
            : true; // Accept any signature in development
        
        if (isSignatureValid) {
            // Payment verified, update order
            order.status = 'Paid';
            order.paymentId = razorpay_payment_id;
            order.razorpayOrderId = razorpay_order_id;
            order.paymentStatus = 'completed';
            await order.save();
            
            res.status(200).json({
                success: true,
                message: 'Payment verified successfully',
                orderId: order.id,
                paymentId: razorpay_payment_id
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }
    } catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        res.status(500).json({
            success: false,
            message: 'Server error verifying payment',
            error: error.message
        });
    }
};

// Get payment status (for testing)
exports.getPaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Verify the order exists
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // In a real implementation, this would check with the payment provider
        // For our system, we'll return the order's payment status
        res.status(200).json({
            orderId: order.id,
            paymentId: order.paymentId || null,
            razorpayOrderId: order.razorpayOrderId || null,
            status: order.status,
            paymentStatus: order.paymentStatus || null,
            amount: order.totalAmount,
            currency: 'INR'
        });
    } catch (error) {
        console.error('Error getting payment status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving payment status',
            error: error.message
        });
    }
};

// Cancel order if payment was not completed
exports.cancelOrderIfPaymentNotCompleted = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        if (!orderId) {
            return res.status(400).json({ message: 'Order ID is required' });
        }
        
        // Verify the order exists
        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        // Only allow cancellation if the order is in 'Payment Pending' status
        if (order.status === 'Payment Pending') {
            // Revert the status to 'pending' or cancel the order
            order.status = 'cancelled';
            order.paymentStatus = 'failed';
            await order.save();
            
            // Optionally, restore the product stock that was reduced when the order was created
            // This would require a function to restore stock based on the order items
            console.log(`Order ${orderId} has been cancelled due to incomplete payment`);
            
            res.status(200).json({
                success: true,
                message: 'Order cancelled successfully',
                orderId: order.id
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled as it is not in Payment Pending status',
                currentStatus: order.status
            });
        }
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'Server error cancelling order',
            error: error.message
        });
    }
};

// Function to clean up orders that are stuck in payment pending status
exports.cleanupStuckPaymentOrders = async () => {
    try {
        // Find orders that have been in 'Payment Pending' status for more than 30 minutes
        const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
        
        const stuckOrders = await Order.findAll({
            where: {
                status: 'Payment Pending',
                createdAt: {
                    [Op.lt]: cutoffTime
                }
            }
        });
        
        for (const order of stuckOrders) {
            console.log(`Cancelling stuck order ${order.id} that was in 'Payment Pending' status for more than 30 minutes`);
            
            // Update the order status to cancelled
            order.status = 'cancelled';
            order.paymentStatus = 'failed';
            await order.save();
            
            // Optionally, restore product stock that was reduced when the order was created
            console.log(`Order ${order.id} has been cancelled due to incomplete payment timeout`);
        }
        
        console.log(`Cleaned up ${stuckOrders.length} stuck payment orders`);
        return stuckOrders.length;
    } catch (error) {
        console.error('Error during stuck payment order cleanup:', error);
        return 0;
    }
};