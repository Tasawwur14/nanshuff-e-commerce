const Coupon = require('../models/Coupon');

// Add a new coupon
exports.addCoupon = async (req, res) => {
    const { code, discountType, discountValue, expirationDate, usageLimit, isActive } = req.body;
    try {
        // Check if coupon with this code already exists
        const existingCoupon = await Coupon.findOne({ where: { code: code.toUpperCase() } });
        if (existingCoupon) {
            return res.status(400).json({ message: 'A coupon with this code already exists.' });
        }
        
        // Validate that discountValue is provided and is a valid number
        if (!discountValue || isNaN(discountValue) || discountValue <= 0) {
            return res.status(400).json({ message: 'Discount value is required and must be a positive number' });
        }
        
        const newCoupon = await Coupon.create({
            code: code.toUpperCase(),
            discountType: discountType || 'percentage',
            discount: discountValue,  // Use correct field name for SQL model
            expiryDate: expirationDate,
            usageLimit: usageLimit,
            active: isActive !== undefined ? isActive : true  // Use correct field name for SQL model
        });
        // Return with mapped fields for frontend compatibility
        res.status(201).json({
            id: newCoupon.id,
            code: newCoupon.code,
            discount: newCoupon.discount,
            discountValue: newCoupon.discount, // For backward compatibility
            discountType: newCoupon.discountType,
            expiryDate: newCoupon.expiryDate,
            minPurchase: newCoupon.minPurchase,
            maxDiscount: newCoupon.maxDiscount,
            usageLimit: newCoupon.usageLimit,
            usageCount: newCoupon.usageCount,
            isActive: newCoupon.active, // Map SQL 'active' to frontend 'isActive'
            active: newCoupon.active, // Keep original for internal use
            createdAt: newCoupon.createdAt,
            updatedAt: newCoupon.updatedAt
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Get all coupons
exports.getAllCoupons = async (req, res) => {
    try {
    const coupons = await Coupon.findAll({ order: [['createdAt', 'DESC']] });
    // Map fields to ensure frontend compatibility
    const mappedCoupons = coupons.map(coupon => {
        const couponJSON = coupon.toJSON();
        return {
            id: couponJSON.id,
            code: couponJSON.code,
            discount: couponJSON.discount,
            discountValue: couponJSON.discount, // For backward compatibility
            discountType: couponJSON.discountType,
            expiryDate: couponJSON.expiryDate,
            minPurchase: couponJSON.minPurchase,
            maxDiscount: couponJSON.maxDiscount,
            usageLimit: couponJSON.usageLimit,
            usageCount: couponJSON.usageCount,
            isActive: couponJSON.active, // Map SQL 'active' to frontend 'isActive'
            active: couponJSON.active, // Keep original for internal use
            createdAt: couponJSON.createdAt,
            updatedAt: couponJSON.updatedAt
        };
    });
    res.json(mappedCoupons);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update a coupon
exports.updateCoupon = async (req, res) => {
    const { code, discountType, discountValue, expiryDate, usageLimit, isActive } = req.body;
    try {
        const coupon = await Coupon.findByPk(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        if (code) coupon.code = code.toUpperCase();
        if (discountType) coupon.discountType = discountType;
        if (discountValue !== undefined && discountValue !== null) {
            coupon.discount = discountValue; // Use correct field name for SQL model
        }
        if (expiryDate) coupon.expiryDate = expiryDate;
        if (usageLimit !== undefined) coupon.usageLimit = usageLimit;
        if (isActive !== undefined) coupon.active = isActive; // Use correct field name for SQL model

    await coupon.save();
    // Return with mapped fields for frontend compatibility
    res.json({
        id: coupon.id,
        code: coupon.code,
        discount: coupon.discount,
        discountValue: coupon.discount, // For backward compatibility
        discountType: coupon.discountType,
        expiryDate: coupon.expiryDate,
        minPurchase: coupon.minPurchase,
        maxDiscount: coupon.maxDiscount,
        usageLimit: coupon.usageLimit,
        usageCount: coupon.usageCount,
        isActive: coupon.active, // Map SQL 'active' to frontend 'isActive'
        active: coupon.active, // Keep original for internal use
        createdAt: coupon.createdAt,
        updatedAt: coupon.updatedAt
    });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Delete a coupon
exports.deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findByPk(req.params.id);
        if (!coupon) return res.status(404).json({ message: 'Coupon not found' });
        await Coupon.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Coupon deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Validate a coupon
exports.validateCoupon = async (req, res) => {
    const { code } = req.query;
    try {
        const coupon = await Coupon.findOne({ where: { code: code.toUpperCase() } });
        
        if (!coupon) {
            return res.status(200).json({ 
                valid: false, 
                message: 'Invalid discount code.' 
            });
        }
        
        // Use the isValid method we added to the schema
        if (!coupon.isValid()) {
            if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
                return res.status(200).json({ 
                    valid: false, 
                    message: 'This discount code has expired.' 
                });
            } else if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
                return res.status(200).json({ 
                    valid: false, 
                    message: 'This discount code has reached its usage limit.' 
                });
            } else {
                return res.status(200).json({ 
                    valid: false, 
                    message: 'This discount code is not active.' 
                });
            }
        }
        
        res.status(200).json({ 
            valid: true, 
            discountPercentage: coupon.discount,  // Use correct field name for SQL model
            code: coupon.code,
            discountType: coupon.discountType || 'percentage'
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};