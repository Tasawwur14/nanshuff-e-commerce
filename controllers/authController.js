const { DB_TYPE } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Use SQL models only (project has migrated to SQL-first)
const sqlModels = require('../models/sql');
const User = sqlModels.User;
const Admin = sqlModels.Admin;
const Cart = sqlModels.Cart;

// User Signup
exports.signupUser = async (req, res) => {
    const { fullName, email, password } = req.body;
    
    // Input validation
    if (!fullName || !fullName.trim()) {
        return res.status(400).json({ message: 'Full name is required' });
    }
    if (!email || !email.trim()) {
        return res.status(400).json({ message: 'Email is required' });
    }
    if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }
    
    try {
        // Check if user exists
        let user = await User.findOne({ where: { email } });
        
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        // Create new user
        user = await User.create({ name: fullName, email, password });
        
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// User Login
exports.loginUser = async (req, res) => {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !email.trim()) {
        return res.status(400).json({ message: 'Email is required' });
    }
    if (!password) {
        return res.status(400).json({ message: 'Password is required' });
    }
    
    try {
        // Find user
        let user = await User.findOne({ where: { email } });
        
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        
        // Check password
        const isMatch = await user.comparePassword(password);
            
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Merge session cart with DB cart
        if (req.session.cart && req.session.cart.items && req.session.cart.items.length > 0) {
            let dbCart = await Cart.findOne({ where: { userId: user.id } });
            if (!dbCart) {
                dbCart = await Cart.create({ userId: user.id, items: [] });
            }
            const items = dbCart.items || [];
            req.session.cart.items.forEach(sessionItem => {
                const dbItemIndex = items.findIndex(p => p.product === sessionItem.product);
                if (dbItemIndex > -1) {
                    items[dbItemIndex].quantity += sessionItem.quantity;
                } else {
                    items.push(sessionItem);
                }
            });
            dbCart.items = items;
            await dbCart.save();
            req.session.cart = { items: [] };
        }

        // Store user in session
        req.session.user = {
            id: user.id,
            email: user.email,
            name: user.name
        };

        const payload = { id: user.id };
        // Persist token for 90 days for "remember me"-style behavior in the browser
        const longExpirySeconds = 90 * 24 * 60 * 60; // 90 days
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: longExpirySeconds },
            (err, token) => {
                if (err) {
                    console.error('JWT sign error:', err);
                    return res.status(500).json({ message: 'Server error during login' });
                }
                // Set token as httpOnly cookie (90 days)
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: longExpirySeconds * 1000,
                    sameSite: 'lax'
                });
                // Return success and token for backward compatibility
                res.json({ token, user: req.session.user });
            }
        );
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Admin Login
exports.loginAdmin = async (req, res) => {
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !username.trim()) {
        return res.status(400).json({ 
            success: false,
            message: 'Username is required' 
        });
    }
    if (!password) {
        return res.status(400).json({ 
            success: false,
            message: 'Password is required' 
        });
    }
    
    try {
        console.log('🔍 Admin Login Attempt:', { username, password: '***' });
        
        // Find admin
        let admin = await Admin.findOne({ where: { username } });
        console.log('👤 Admin found:', admin ? { id: admin.id, username: admin.username } : null);
        
        if (!admin) {
            console.log('❌ Admin not found for username:', username);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid username or password' 
            });
        }
        
        // Check password
        console.log('🔐 Comparing passwords...');
        console.log('📦 Admin password hash exists:', !!admin.password);
        const isMatch = await admin.comparePassword(password);
        console.log('✓ Password match result:', isMatch);
            
        if (!isMatch) {
            console.log('❌ Password does not match');
            return res.status(401).json({ 
                success: false,
                message: 'Invalid username or password' 
            });
        }

        const payload = { id: admin.id, role: 'admin' };

        // Persist admin token for 90 days
        const longExpirySeconds = 90 * 24 * 60 * 60; // 90 days
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: longExpirySeconds },
            (err, token) => {
                if (err) {
                    console.error('JWT sign error:', err);
                    return res.status(500).json({ 
                        success: false,
                        message: 'Server error during login.' 
                    });
                }
                // Set cookie for 90 days
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: longExpirySeconds * 1000,
                    sameSite: 'lax'
                });
                // Send token also in body for compatibility
                res.status(200).json({ 
                    success: true,
                    token 
                });
            }
        );
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error during login.' 
        });
    }
};

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
    try {
        let users = await User.findAll({ 
            attributes: { exclude: ['password'] }
        });
        
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get admin profile
exports.getAdminProfile = async (req, res) => {
    try {
        // req.admin comes from the middleware and contains the decoded JWT payload
        // The admin ID should be in req.admin.id
        const adminId = req.admin.id;
        
        if (!adminId) {
            return res.status(400).json({ message: 'Admin ID not found in token' });
        }
        
        const admin = await Admin.findByPk(adminId, { attributes: { exclude: ['password'] } });
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }
        
        res.json({
            username: admin.username,
            fullName: admin.fullName,
            email: admin.email
        });
    } catch (error) {
        console.error('Error fetching admin profile:', error);
        res.status(500).json({ message: 'Server error while fetching profile', error: error.message });
    }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
    try {
        // req.user comes from authMiddleware and contains the decoded JWT payload with id
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(400).json({ message: 'User ID not found in token' });
        }
        
        const user = await User.findByPk(userId, { attributes: { exclude: ['password'] } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            id: user.id,
            fullName: user.name,
            email: user.email,
            phone: user.phone || '',
            address: user.address || '',
            city: user.city || '',
            state: user.state || '',
            postalCode: user.postalCode || '',
            country: user.country || 'India'
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error while fetching profile', error: error.message });
    }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
    const { fullName, phone, address, city, state, postalCode, country } = req.body;
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user fields if provided
        if (fullName) user.name = fullName.trim();
        if (phone) user.phone = phone.trim();
        if (address) user.address = address.trim();
        if (city) user.city = city.trim();
        if (state) user.state = state.trim();
        if (postalCode) user.postalCode = postalCode.trim();
        if (country) user.country = country.trim();

        const updatedUser = await user.save();
        res.json({ 
            message: 'Profile updated successfully', 
            user: { 
                id: updatedUser.id,
                fullName: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone || '',
                address: updatedUser.address || '',
                city: updatedUser.city || '',
                state: updatedUser.state || '',
                postalCode: updatedUser.postalCode || '',
                country: updatedUser.country || 'India'
            } 
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error while updating profile', error: error.message });
    }
};

// Update admin profile (Username, Name, Email)
exports.updateAdminProfile = async (req, res) => {
    const { username, fullName, email } = req.body;
    try {
        const admin = await Admin.findByPk(req.admin.id);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        // If username is being updated, check for uniqueness
        if (username && username !== admin.username) {
            const { Op } = require('sequelize');
            const existingAdmin = await Admin.findOne({ where: { username: username.trim(), id: { [Op.ne]: req.admin.id } } });

            if (existingAdmin) {
                return res.status(400).json({ message: 'Username already exists. Please choose a different username.' });
            }

            admin.username = username.trim();
        }

        admin.fullName = fullName || admin.fullName;
        admin.email = email || admin.email;

        const updatedAdmin = await admin.save();
        res.json({ 
            message: 'Profile updated successfully', 
            admin: { 
                username: updatedAdmin.username,
                fullName: updatedAdmin.fullName, 
                email: updatedAdmin.email 
            } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error while updating profile', error: error.message });
    }
};

// Update admin password
exports.updateAdminPassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    try {
        const admin = await Admin.findByPk(req.admin.id);
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        const isMatch = await bcrypt.compare(oldPassword, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect old password' });
        }

        admin.password = newPassword;
        await admin.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error while updating password' });
    }
};

// Forgot password - send reset link
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    
    // Input validation
    if (!email || !email.trim()) {
        return res.status(400).json({ message: 'Email is required' });
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }
    
    try {
        // Find user by email
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            // Return success message even if user doesn't exist to prevent email enumeration
            return res.status(200).json({ message: 'If an account with this email exists, a password reset link has been sent.' });
        }
        
        // Generate reset token
        const crypto = require('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // Set token and expiration (1 hour from now)
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        
        await user.save();
        
        // Send password reset email
        const emailController = require('./emailController');
        const emailResult = await emailController.sendPasswordResetEmail(user, resetToken);
        
        if (emailResult.success) {
            res.status(200).json({ message: 'If an account with this email exists, a password reset link has been sent.' });
        } else {
            console.error('Error sending password reset email:', emailResult.error);
            // Still return success to prevent email enumeration, but log the error
            res.status(200).json({ message: 'If an account with this email exists, a password reset link has been sent.' });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Reset password - verify token and update password
exports.resetPassword = async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;
    
    // Input validation
    if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'Token, new password, and confirm password are required' });
    }
    
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New password and confirm password do not match' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    try {
        // Find user with valid reset token
        const user = await User.findOne({ 
            where: { 
                resetPasswordToken: token,
                resetPasswordExpires: { [require('sequelize').Op.gt]: Date.now() }
            } 
        });
        
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }
        
        // Update user password (the model's beforeUpdate hook will hash it)
        user.password = newPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        
        await user.save();
        
        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};