const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Coupon = sequelize.define('Coupon', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        discount: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false
        },
        discountType: {
            type: DataTypes.ENUM('percentage', 'fixed'),
            defaultValue: 'percentage'
        },
        expiryDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        minPurchase: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0
        },
        maxDiscount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        usageLimit: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        usageCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'coupons',
        timestamps: true
    });

    // Add instance method to check if coupon is valid
    Coupon.prototype.isValid = function() {
        // Check if coupon is active
        if (!this.active) return false;
        
        // Check if coupon has expired
        if (this.expiryDate && new Date() > new Date(this.expiryDate)) return false;
        
        // Check if coupon has reached usage limit
        if (this.usageLimit && this.usageCount >= this.usageLimit) return false;
        
        return true;
    };

    return Coupon;
};
