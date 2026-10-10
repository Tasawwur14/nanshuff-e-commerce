// Use SQL models only (project has migrated to SQL-first)
const sqlModels = require('../models/sql');
const User = sqlModels.User;
const nodemailer = require('nodemailer');

// Create a nodemailer transporter (using a mock transporter for development)
// In production, you would configure with actual email service credentials
const createTransporter = () => {
    // Check if email environment variables are set
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        // Production configuration
        return nodemailer.createTransporter({
            service: process.env.EMAIL_SERVICE || 'gmail', // Default to Gmail
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } else {
        // For development or if not configured, use a transporter
        // that logs emails and optionally sends to a test email
        return {
            sendMail: async (mailOptions) => {
                console.log('==================================================');
                console.log('EMAIL DEBUG INFO (Development Mode)');
                console.log('To:', mailOptions.to);
                console.log('Subject:', mailOptions.subject);
                console.log('==================================================');
                console.log('HTML Content:');
                console.log(mailOptions.html || mailOptions.text);
                console.log('==================================================');
                
                // If test email is configured, send to test email instead of actual recipient
                if (process.env.TEST_EMAIL) {
                    console.log('Sending development email to test address:', process.env.TEST_EMAIL);
                    mailOptions.to = process.env.TEST_EMAIL;
                    
                    // Create a simple transporter for development that uses default SMTP
                    const devTransporter = nodemailer.createTransporter({
                        host: process.env.SMTP_HOST || 'smtp.gmail.com',
                        port: process.env.SMTP_PORT || 587,
                        secure: process.env.SMTP_SECURE === 'true' || false,
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS
                        }
                    });
                    
                    try {
                        const result = await devTransporter.sendMail(mailOptions);
                        console.log('Test email sent successfully:', result.messageId);
                        return result;
                    } catch (error) {
                        console.error('Error sending test email:', error);
                        throw error;
                    }
                } else {
                    console.log('No test email configured. To enable test emails, set TEST_EMAIL in your .env file');
                    console.log('Set these environment variables to enable actual email sending:');
                    console.log('- EMAIL_SERVICE (e.g., gmail)');
                    console.log('- EMAIL_USER (your email address)');
                    console.log('- EMAIL_PASS (your app password)');
                    console.log('- TEST_EMAIL (optional, to send all emails to this address for testing)');
                    console.log('==================================================');
                    
                    // Return a mock success response
                    return { messageId: 'mock-message-id' };
                }
            }
        };
    }
};

// Send email campaign to all users
exports.sendEmailCampaign = async (req, res) => {
    try {
        const { subject, message } = req.body;
        
        // Validate input
        if (!subject || !message) {
            return res.status(400).json({ 
                message: 'Subject and message are required' 
            });
        }
        
        // Get all users to send the email to
        const users = await User.findAll({ attributes: ['email', 'name'] });
        
        if (users.length === 0) {
            return res.status(200).json({ 
                message: 'No users found to send the email to' 
            });
        }
        
        const transporter = createTransporter();
        let successCount = 0;
        let errorCount = 0;
        
        // Send email to each user
        for (const user of users) {
            try {
                // Personalize the message for each user
                const personalizedMessage = message.replace(/{name}/g, user.name || 'Customer');
                
                await transporter.sendMail({
                    from: process.env.EMAIL_USER || 'noreply@yoursite.com',
                    to: user.email,
                    subject: subject,
                    html: personalizedMessage
                });
                
                successCount++;
            } catch (err) {
                console.error(`Error sending email to ${user.email}:`, err);
                errorCount++;
            }
        }
        
        res.status(200).json({
            message: `Email campaign sent successfully to ${successCount} users`,
            successCount,
            errorCount,
            totalUsers: users.length
        });
        
    } catch (error) {
        console.error('Error sending email campaign:', error);
        res.status(500).json({ 
            message: 'Server error while sending email campaign',
            error: error.message 
        });
    }
};

// Send password reset email
exports.sendPasswordResetEmail = async (user, resetToken) => {
    try {
        const transporter = createTransporter();
        
        // Construct the reset link with the token
        const resetLink = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@nanshhuf.com',
            to: user.email,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #8B4513;">Password Reset Request</h2>
                    <p>Hello ${user.name || 'User'},</p>
                    <p>You have requested to reset your password. Click the button below to set a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #8B4513; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="word-break: break-all;">${resetLink}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request a password reset, please ignore this email.</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                    <p style="color: #666; font-size: 12px;">This is an automated message from Nanshhuf. Please do not reply to this email.</p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return { success: false, error: error.message };
    }
};

// Get email campaign statistics (placeholder)
exports.getEmailCampaignStats = async (req, res) => {
    try {
        // In a real implementation, you would track sent emails, open rates, etc.
        // For now, return placeholder data
        res.status(200).json({
            totalCampaignsSent: 0,
            totalEmailsSent: 0,
            averageOpenRate: 0,
            averageClickRate: 0
        });
    } catch (error) {
        console.error('Error fetching email campaign stats:', error);
        res.status(500).json({ 
            message: 'Server error while fetching email campaign stats',
            error: error.message 
        });
    }
};