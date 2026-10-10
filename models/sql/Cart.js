const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Cart = sequelize.define('Cart', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        items: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: []
        }
    }, {
        tableName: 'carts',
        timestamps: true
    });

    return Cart;
};
