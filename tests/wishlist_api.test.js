const request = require('supertest');
const { sequelize } = require('../config/database');
const models = require('../models/sql');
const app = require('../server');
const User = models.User;
const Product = models.Product;
const Wishlist = models.Wishlist;

describe('Wishlist API Tests', () => {
  let testUser, testProduct, authToken;

  beforeAll(async () => {
    // Connect to database and ensure models are initialized
    await sequelize.authenticate();
    await sequelize.sync();
    
    // Clean up any existing test data
    await Wishlist.destroy({ where: {} });
    await User.destroy({ where: { email: 'wishlisttest@example.com' } });
    await Product.destroy({ where: { name: 'Test Product' } });
    
    // Create a test user
    testUser = await User.create({
      name: 'Test User',
      email: 'wishlisttest@example.com',
      password: 'password',
      phone: '1234567890',
      address: 'Test Address'
    });

    // Create a test product
    testProduct = await Product.create({
      name: 'Test Product',
      price: 100,
      discount: 10,
      stock: 10,
      category: 'Test Category',
      imageUrl: 'https://example.com/test.jpg',
      short_description: 'Test product description',
      long_description: 'Test product long description',
      ingredients: 'Test ingredients',
      how_to_use: 'Test usage instructions',
      featured: true
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser && testProduct) {
      await Wishlist.destroy({ where: { userId: testUser.id, productId: testProduct.id } });
      await Product.destroy({ where: { id: testProduct.id } });
      await User.destroy({ where: { id: testUser.id } });
    }
    
    await sequelize.close();
  });

  // Test: Get JWT token for authentication
  it('should authenticate user and get token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'wishlisttest@example.com',
        password: 'password'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    authToken = response.body.token;
  });

  // Test: Add product to wishlist
  it('should add product to wishlist', async () => {
    if (!authToken) {
      // Get token first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wishlisttest@example.com',
          password: 'password'
        });
      authToken = loginResponse.body.token;
    }

    const response = await request(app)
      .post('/api/users/wishlist')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ productId: testProduct.id });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Product added to wishlist');
  });

  // Test: Get user's wishlist
  it('should get user\'s wishlist', async () => {
    const response = await request(app)
      .get('/api/users/wishlist')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('productId', testProduct.id);
  });

  // Test: Check if product is in wishlist
  it('should check if product is in wishlist', async () => {
    const response = await request(app)
      .get(`/api/users/wishlist/${testProduct.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('inWishlist', true);
  });

  // Test: Remove product from wishlist
  it('should remove product from wishlist', async () => {
    const response = await request(app)
      .delete(`/api/users/wishlist/${testProduct.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Product removed from wishlist');
  });

  // Test: Verify product is removed from wishlist
  it('should confirm product is removed from wishlist', async () => {
    const response = await request(app)
      .get(`/api/users/wishlist/${testProduct.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('inWishlist', false);
  });
});