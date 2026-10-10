const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Order = sequelize.define('Order', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        orderNumber: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        items: {
            type: DataTypes.JSON,
            allowNull: false
        },
        totalAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        subtotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        discountAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0
        },
        discountPercentage: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true,
            defaultValue: 0
        },
        status: {
            type: DataTypes.ENUM('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'Payment Pending'),
            defaultValue: 'pending'
        },
        paymentMethod: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        paymentStatus: {
            type: DataTypes.ENUM('pending', 'completed', 'failed'),
            defaultValue: 'pending'
        },
        paymentId: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        razorpayOrderId: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        shippingAddress: {
            type: DataTypes.JSON,
            allowNull: false
        },
        trackingNumber: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        coupon: {
            type: DataTypes.STRING(50),
            allowNull: true
        }
    }, {
        tableName: 'orders',
        timestamps: true
    });

    return Order;
};
