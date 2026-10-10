const request = require('supertest');
const express = require('express');
const orderRoutes = require('../routes/orderRoutes');
const cartRoutes = require('../routes/cartRoutes');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const { sequelize } = require('../config/database');

// Mock the auth middleware
jest.mock('../middleware/authMiddleware', () => {
    const mockAuth = jest.fn((req, res, next) => next());
    return {
        isLoggedIn: mockAuth,
        isAdminLoggedIn: (req, res, next) => next(),
        optionalAuth: mockAuth
    };
});

const { isLoggedIn } = require('../middleware/authMiddleware');

const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);


beforeAll(async () => {
    // Use in-memory SQLite for tests (configured via config/database when NODE_ENV=test)
    await sequelize.sync({ force: true });
});

afterAll(async () => {
    await sequelize.close();
});

afterEach(async () => {
    // Truncate all tables
    await Order.destroy({ where: {} });
    await Cart.destroy({ where: {} });
    await Product.destroy({ where: {} });
    await Coupon.destroy({ where: {} });
    // Ensure test users are removed as well
    await require('../models/User').destroy({ where: {} });
});

describe('Order API', () => {
    it('should not create an order with an empty cart', async () => {
    // For SQL tests we'll simulate a numeric user id
    const userId = 1;
        isLoggedIn.mockImplementation((req, res, next) => {
            req.user = { id: userId };
            next();
        });

        const res = await request(app)
            .post('/api/orders')
            .send({});

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toBe('Cart is empty');
    });

    it('should not create an order with insufficient stock', async () => {
    const userId = 2;
        isLoggedIn.mockImplementation((req, res, next) => {
            req.user = { id: userId };
            next();
        });

    // create a user for FK constraints
    await require('../models/User').create({ id: userId, name: 'Test User', email: `user${userId}@test.local`, password: 'password' });
    const product = await Product.create({ name: 'Test Product', sku: 'TP001', category: 'Test Category', price: 10, stock: 1, imageUrl: 'test.jpg' });
    await Cart.create({ userId: userId, items: [{ productId: product.id, quantity: 2 }] });

        const res = await request(app)
            .post('/api/orders')
            .send({});

    expect(res.statusCode).toEqual(500);
    // message includes available stock details
    expect(res.body.message).toContain('Not enough stock for Test Product');
    });

    it('should create an order with a valid coupon', async () => {
    const userId = 3;
        isLoggedIn.mockImplementation((req, res, next) => {
            req.user = { id: userId };
            next();
        });

    await require('../models/User').create({ id: userId, name: 'Test User', email: `user${userId}@test.local`, password: 'password' });
    const product = await Product.create({ name: 'Test Product', sku: 'TP001', category: 'Test Category', price: 10, stock: 10, imageUrl: 'test.jpg' });
    await Coupon.create({ code: 'SUMMER10', discount: 10 });
    await Cart.create({ userId: userId, items: [{ productId: product.id, quantity: 1 }] });

        const res = await request(app)
            .post('/api/orders')
            .send({ couponCode: 'SUMMER10' });

    expect(res.statusCode).toEqual(201);
    const order = await Order.findByPk(res.body.orderId);
    expect(order.totalAmount).toBe(9);
    });

    it('should not create an order with an expired coupon', async () => {
    const userId = 4;
        isLoggedIn.mockImplementation((req, res, next) => {
            req.user = { id: userId };
            next();
        });

    await require('../models/User').create({ id: userId, name: 'Test User', email: `user${userId}@test.local`, password: 'password' });
    const product = await Product.create({ name: 'Test Product', sku: 'TP001', category: 'Test Category', price: 10, stock: 10, imageUrl: 'test.jpg' });
    await Coupon.create({ code: 'WINTER10', discount: 10, expiryDate: new Date('2020-01-01') });
    await Cart.create({ userId: userId, items: [{ productId: product.id, quantity: 1 }] });

        const res = await request(app)
            .post('/api/orders')
            .send({ couponCode: 'WINTER10' });

    expect(res.statusCode).toEqual(500);
    expect(res.body.message).toBe('Coupon has expired');
    });
});
