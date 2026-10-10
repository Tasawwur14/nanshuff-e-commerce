const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Product = sequelize.define('Product', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        discount: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0
        },
        category: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        categoryId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'categories',
                key: 'id'
            }
        },
        stock: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        image: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        imageUrl: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        images: {
            type: DataTypes.JSON,
            allowNull: true
        },
        videoUrl: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        sku: {
            type: DataTypes.STRING(50),
            allowNull: true,
            unique: true
        },
        featured: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        weight: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        dimensions: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        ingredients: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        nutritionalInfo: {
            type: DataTypes.JSON,
            allowNull: true
        },
        tags: {
            type: DataTypes.JSON,
            allowNull: true
        },
        mrp: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        status: {
            type: DataTypes.STRING(50),
            defaultValue: 'In Stock'
        },
        short_description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        long_description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        how_to_use: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'products',
        timestamps: true,
        hooks: {
            // Convert DECIMAL fields to numbers in toJSON
            afterFind: (products) => {
                if (!products) return;
                const convert = (product) => {
                    if (product.price !== undefined && product.price !== null) {
                        product.price = Number(product.price);
                    }
                    if (product.discount !== undefined && product.discount !== null) {
                        product.discount = Number(product.discount);
                    }
                    if (product.mrp !== undefined && product.mrp !== null) {
                        product.mrp = Number(product.mrp);
                    }
                    return product;
                };
                if (Array.isArray(products)) {
                    return products.map(convert);
                } else {
                    return convert(products);
                }
            }
        }
    });

    return Product;
};
