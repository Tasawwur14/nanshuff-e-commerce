const nodemailer = require('nodemailer');
const logger = require('./logger');

// Email transporter configuration
let transporter = null;

// Initialize email transporter
const initializeTransporter = () => {
    if (transporter) return transporter;

    if (process.env.EMAIL_SERVICE === 'gmail' && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    } else {
        // Development mode - mock transporter
        transporter = {
            sendMail: async (mailOptions) => {
                logger.info(`[EMAIL DEV MODE] To: ${mailOptions.to}`);
                logger.info(`[EMAIL DEV MODE] Subject: ${mailOptions.subject}`);
                logger.debug(`[EMAIL DEV MODE] Body: ${mailOptions.html || mailOptions.text}`);
                return { messageId: 'dev-mode-message-id' };
            }
        };
    }

    return transporter;
};

// Email Templates
const emailTemplates = {
    // Order Confirmation Email
    orderConfirmation: (orderData) => {
        const { orderNumber, items, total, customerName, email } = orderData;
        const itemsHtml = items.map(item => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        return {
            subject: `Order Confirmation #${orderNumber} - Nanshhuf`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #8B6F47; color: white; padding: 20px; text-align: center; }
                        .content { background-color: #f9f9f9; padding: 20px; }
                        .order-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Order Confirmation</h1>
                        </div>
                        <div class="content">
                            <p>Hello ${customerName},</p>
                            <p>Thank you for your order! Here are your order details:</p>
                            <p><strong>Order Number:</strong> ${orderNumber}</p>
                            <table class="order-table">
                                <thead>
                                    <tr style="background-color: #8B6F47; color: white;">
                                        <th style="padding: 10px; text-align: left;">Product</th>
                                        <th style="padding: 10px; text-align: center;">Quantity</th>
                                        <th style="padding: 10px; text-align: right;">Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemsHtml}
                                </tbody>
                            </table>
                            <p style="text-align: right; font-size: 16px; font-weight: bold;">
                                <strong>Total:</strong> ₹${total.toFixed(2)}
                            </p>
                            <p>Your order will be processed soon. You'll receive tracking information via email.</p>
                            <p>Thank you for choosing Nanshhuf!</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 Nanshhuf. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                Order Confirmation #${orderNumber}
                
                Hello ${customerName},
                
                Thank you for your order!
                
                Items:
                ${items.map(item => `${item.name} x${item.quantity} - ₹${(item.price * item.quantity).toFixed(2)}`).join('\n')}
                
                Total: ₹${total.toFixed(2)}
                
                Your order will be processed soon.
                
                Thank you for choosing Nanshhuf!
            `
        };
    },

    // Password Reset Email
    passwordReset: (resetLink, userName) => ({
        subject: 'Password Reset - Nanshhuf',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #8B6F47; color: white; padding: 20px; text-align: center; }
                    .content { background-color: #f9f9f9; padding: 20px; }
                    .button { background-color: #8B6F47; color: white; padding: 12px 30px; text-align: center; text-decoration: none; border-radius: 5px; display: inline-block; }
                    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <p>Hello ${userName},</p>
                        <p>We received a request to reset your password. Click the button below to proceed:</p>
                        <p style="text-align: center; margin: 20px 0;">
                            <a href="${resetLink}" class="button">Reset Password</a>
                        </p>
                        <p>If you didn't request a password reset, please ignore this email.</p>
                        <p>This link will expire in 24 hours.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2025 Nanshhuf. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
            Password Reset Request
            
            Hello ${userName},
            
            Click the link below to reset your password:
            ${resetLink}
            
            This link will expire in 24 hours.
            
            If you didn't request this, please ignore this email.
        `
    }),

    // Shipping Notification Email
    shippingNotification: (trackingData) => {
        const { orderNumber, trackingNumber, estimatedDelivery, customerName } = trackingData;
        return {
            subject: `Your Order #${orderNumber} Has Shipped - Nanshhuf`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #8B6F47; color: white; padding: 20px; text-align: center; }
                        .content { background-color: #f9f9f9; padding: 20px; }
                        .tracking-box { background-color: #e8f4f8; padding: 15px; border-left: 4px solid #8B6F47; margin: 20px 0; }
                        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Order Shipped!</h1>
                        </div>
                        <div class="content">
                            <p>Hello ${customerName},</p>
                            <p>Great news! Your order has been shipped and is on its way to you.</p>
                            <div class="tracking-box">
                                <p><strong>Order Number:</strong> ${orderNumber}</p>
                                <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
                                <p><strong>Estimated Delivery:</strong> ${estimatedDelivery}</p>
                            </div>
                            <p>You can track your shipment using the tracking number above.</p>
                            <p>Thank you for shopping with Nanshhuf!</p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 Nanshhuf. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                Order Shipped!
                
                Hello ${customerName},
                
                Your order #${orderNumber} has been shipped!
                
                Tracking Number: ${trackingNumber}
                Estimated Delivery: ${estimatedDelivery}
                
                Thank you for shopping with Nanshhuf!
            `
        };
    },

    // Promotional Email
    promotional: (promoData) => {
        const { title, message, offerDetails, customerName } = promoData;
        return {
            subject: title,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #8B6F47; color: white; padding: 20px; text-align: center; }
                        .content { background-color: #f9f9f9; padding: 20px; }
                        .promo-box { background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
                        .button { background-color: #8B6F47; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; }
                        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${title}</h1>
                        </div>
                        <div class="content">
                            <p>Hello ${customerName},</p>
                            <p>${message}</p>
                            <div class="promo-box">
                                <h2 style="color: #8B6F47;">${offerDetails}</h2>
                            </div>
                            <p style="text-align: center;">
                                <a href="${process.env.APP_URL || 'https://nanshhuf.com'}/products" class="button">Shop Now</a>
                            </p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2025 Nanshhuf. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                ${title}
                
                Hello ${customerName},
                
                ${message}
                
                ${offerDetails}
                
                Visit us: ${process.env.APP_URL || 'https://nanshhuf.com'}/products
            `
        };
    }
};

// Main email sending function
const sendEmail = async (to, emailType, emailData) => {
    try {
        const transporter = initializeTransporter();
        
        let mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'nanshhuf@example.com',
            to: to
        };

        // Get template based on email type
        const template = emailTemplates[emailType];
        if (!template) {
            throw new Error(`Unknown email type: ${emailType}`);
        }

        const templateContent = typeof template === 'function' ? template(emailData) : template;
        mailOptions = { ...mailOptions, ...templateContent };

        // Send email
        const result = await transporter.sendMail(mailOptions);
        logger.info(`Email sent successfully: ${emailType} to ${to}`);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        logger.error(`Error sending email (${emailType}):`, error);
        // Don't throw error - log and continue (emails shouldn't block order flow)
        return { success: false, error: error.message };
    }
};

// Helper functions for specific email types
const sendOrderConfirmation = (email, orderData) => sendEmail(email, 'orderConfirmation', orderData);
const sendPasswordReset = (email, resetLink, userName) => sendEmail(email, 'passwordReset', { resetLink, userName });
const sendShippingNotification = (email, trackingData) => sendEmail(email, 'shippingNotification', trackingData);
const sendPromotionalEmail = (email, promoData) => sendEmail(email, 'promotional', promoData);

module.exports = {
    initializeTransporter,
    sendEmail,
    sendOrderConfirmation,
    sendPasswordReset,
    sendShippingNotification,
    sendPromotionalEmail,
    emailTemplates
};
