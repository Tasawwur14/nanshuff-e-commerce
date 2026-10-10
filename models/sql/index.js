const { sequelize } = require('../../config/database');

// Import model definitions
const AdminModel = require('./Admin');
const UserModel = require('./User');
const CategoryModel = require('./Category');
const ProductModel = require('./Product');
const CartModel = require('./Cart');
const OrderModel = require('./Order');
const CouponModel = require('./Coupon');
const NotificationModel = require('./Notification');
const WishlistModel = require('./Wishlist');

// Initialize models
const Admin = AdminModel(sequelize);
const User = UserModel(sequelize);
const Category = CategoryModel(sequelize);
const Product = ProductModel(sequelize);
const Cart = CartModel(sequelize);
const Order = OrderModel(sequelize);
const Coupon = CouponModel(sequelize);
const Notification = NotificationModel(sequelize);
const Wishlist = WishlistModel(sequelize);

// Define associations
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'categoryDetails' });
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });

Cart.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasOne(Cart, { foreignKey: 'userId', as: 'cart' });

Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });

Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

Wishlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Wishlist, { foreignKey: 'userId', as: 'wishlists' });

Wishlist.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(Wishlist, { foreignKey: 'productId', as: 'wishlists' });

module.exports = {
    sequelize,
    Admin,
    User,
    Category,
    Product,
    Cart,
    Order,
    Coupon,
    Notification,
    Wishlist
};
