// Use SQL models only (project has migrated to SQL-first)
const sqlModels = require('../models/sql');
const User = sqlModels.User;
const nodemailer = require('nodemailer');

// Check if a real email service is configured with valid credentials
const isEmailConfigured = () => {
    if (process.env.BREVO_API_KEY && !process.env.BREVO_API_KEY.includes('your-key')) {
        return true;
    }
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    if (!user || !pass) return false;
    if (user.includes('yourdomain.com') || pass.includes('your-email-password')) return false;
    return true;
};

// Create a nodemailer transporter (fallback SMTP transporter)
const createTransporter = () => {
    const pass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    if (isEmailConfigured()) {
        if (process.env.EMAIL_HOST && !process.env.EMAIL_HOST.includes('yourdomain.com')) {
            return nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT, 10) || 587,
                secure: process.env.EMAIL_SECURE === 'true' || process.env.EMAIL_PORT === '465',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: pass
                }
            });
        }
        return nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: pass
            }
        });
    } else {
        // Development mock transporter when no service configured
        return {
            sendMail: async (mailOptions) => {
                console.log('==================================================');
                console.log('EMAIL DEBUG INFO (Development Mock Mode)');
                console.log('To:', mailOptions.to);
                console.log('Subject:', mailOptions.subject);
                console.log('==================================================');
                console.log('HTML Content:');
                console.log(mailOptions.html || mailOptions.text);
                console.log('==================================================');
                return { messageId: 'mock-dev-message-id' };
            }
        };
    }
};

// Unified sendEmail function supporting Brevo REST API and Nodemailer
const sendEmail = async ({ to, subject, html, text }) => {
    // 1. Prioritize Brevo REST API if configured
    if (process.env.BREVO_API_KEY && !process.env.BREVO_API_KEY.includes('your-key')) {
        const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || 'tasawwarkhan14@gmail.com';
        const senderName = process.env.BREVO_SENDER_NAME || 'Nanshhuf';
        const toList = Array.isArray(to) ? to.map(e => typeof e === 'string' ? { email: e } : e) : [{ email: to }];

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: senderName, email: senderEmail },
                to: toList,
                subject: subject,
                htmlContent: html,
                textContent: text
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            console.error('Brevo API delivery error:', data);
            throw new Error(data.message || 'Brevo email delivery failed');
        }

        console.log(`✉️ [BREVO] Email successfully sent to ${Array.isArray(to) ? to.join(', ') : to}. MessageId: ${data.messageId}`);
        return { success: true, messageId: data.messageId };
    }

    // 2. Fallback to standard Nodemailer transporter
    const transporter = createTransporter();
    const result = await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@nanshhuf.com',
        to,
        subject,
        html,
        text
    });
    return { success: true, messageId: result.messageId };
};

// Send email campaign to all users
exports.sendEmailCampaign = async (req, res) => {
    try {
        const { subject, message } = req.body;
        
        if (!subject || !message) {
            return res.status(400).json({ 
                message: 'Subject and message are required' 
            });
        }
        
        const users = await User.findAll({ attributes: ['email', 'name'] });
        
        if (users.length === 0) {
            return res.status(200).json({ 
                message: 'No users found to send the email to' 
            });
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const user of users) {
            try {
                const personalizedMessage = message.replace(/{name}/g, user.name || 'Customer');
                await sendEmail({
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
        const resetLink = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #eaeaea; border-radius: 10px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 25px;">
                    <h1 style="color: #8C6A5D; margin: 0; font-size: 32px; font-family: serif; letter-spacing: 2px;">NANSHHUF</h1>
                    <p style="color: #73564B; font-size: 13px; margin-top: 4px; letter-spacing: 1px;">PREMIUM FROZEN LUXURY</p>
                </div>
                
                <div style="border-top: 1px solid #eee; padding-top: 20px;">
                    <h2 style="color: #2C2C2C; margin-bottom: 12px; font-size: 20px;">Password Reset Request</h2>
                    <p style="color: #555; line-height: 1.6;">Hello <strong>${user.name || 'Valued Customer'}</strong>,</p>
                    <p style="color: #555; line-height: 1.6;">We received a request to reset the password for your Nanshhuf account. Click the button below to choose a new password:</p>
                    
                    <div style="text-align: center; margin: 32px 0;">
                        <a href="${resetLink}" style="background-color: #8C6A5D; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(140,106,93,0.25);">Reset Password</a>
                    </div>
                    
                    <p style="color: #666; font-size: 13px; line-height: 1.6;">If the button above does not work, copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #8C6A5D; font-size: 12px; background: #FAF7F2; padding: 10px; border-radius: 5px;">
                        <a href="${resetLink}" style="color: #8C6A5D; text-decoration: underline;">${resetLink}</a>
                    </p>
                    
                    <p style="color: #888; font-size: 12px; margin-top: 20px;">⏰ This link will expire in <strong>1 hour</strong>.</p>
                    <p style="color: #888; font-size: 12px;">If you did not request this password reset, please ignore this email or contact support if you have concerns.</p>
                </div>
                
                <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #999; font-size: 11px; text-align: center; margin: 0;">&copy; 2026 Nanshhuf. All rights reserved.</p>
            </div>
        `;

        const result = await sendEmail({
            to: user.email,
            subject: 'Password Reset Request - Nanshhuf',
            html
        });

        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return { success: false, error: error.message };
    }
};

// Get email campaign statistics (placeholder)
exports.getEmailCampaignStats = async (req, res) => {
    try {
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

exports.sendEmail = sendEmail;
exports.isEmailConfigured = isEmailConfigured;