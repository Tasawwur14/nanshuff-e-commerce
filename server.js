// server/server.js

require('dotenv').config();

// Ensure required environment variables are set
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  Warning: JWT_SECRET not set in environment. Using a default development secret.');
    console.warn('   Set JWT_SECRET in your .env file for production.');
    process.env.JWT_SECRET = 'dev-default-secret-change-in-production';
}

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const winston = require('winston');

// Import database configuration
const { connectDatabase, closeConnections, DB_TYPE, sequelize } = require('./config/database');
const { Op } = require('sequelize');
const Product = require('./models/Product');

// Rate limiter configuration - Optimized for production e-commerce with many visitors
// Key function to identify users: logged-in users tracked by userId, guests by IP
const generateRateLimitKey = (req) => {
    // Prioritize user ID for logged-in users (from JWT token or session)
    if (req.user && req.user.id) {
        return `user:${req.user.id}`;
    }
    if (req.session && req.session.user && req.session.user.id) {
        return `user:${req.session.user.id}`;
    }
    // Fall back to IP for guests
    return `ip:${req.ip}`;
};

// Very permissive limiter for public browsing (products, cart viewing)
const publicBrowsingLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: async (req) => {
        // Logged-in users get higher limits
        if (req.user || (req.session && req.session.user)) {
            return 100; // 100 requests per minute for logged-in users
        }
        return 60; // 60 requests per minute for guests
    },
    keyGenerator: generateRateLimitKey,
    message: JSON.stringify({ error: 'Too many requests, please slow down.' }),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests, please slow down and try again.',
            retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        });
    }
});

// Moderate limiter for write operations (add to cart, update cart)
const writeOperationLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: async (req) => {
        if (req.user || (req.session && req.session.user)) {
            return 30; // 30 writes per minute for logged-in users
        }
        return 20; // 20 writes per minute for guests
    },
    keyGenerator: generateRateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests, please wait a moment.',
            retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        });
    }
});

// Strict limiter for authentication endpoints (prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Only 10 login attempts per 15 minutes
    keyGenerator: (req) => `auth:${req.ip}`, // Always use IP for auth
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many authentication attempts. Please try again later.',
            retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        });
    }
});

// Moderate limiter for payment/order operations
const paymentLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 payment operations per 5 minutes
    keyGenerator: generateRateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many payment requests. Please wait before trying again.',
            retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        });
    }
});

// Import route files
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes'); 
const orderRoutes = require('./routes/orderRoutes');
const couponRoutes = require('./routes/couponRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const emailRoutes = require('./routes/emailRoutes');
const contactRoutes = require('./routes/contactRoutes');

// Import payment controller for cleanup function
const paymentController = require('./controllers/paymentController');

// Import middleware
const { isAdminLoggedIn } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup logger
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Production checks
if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || !process.env.SESSION_SECRET) {
        logger.error('Critical secrets are not set in production. Aborting startup.');
        throw new Error('Missing critical environment variables: JWT_SECRET and SESSION_SECRET');
    }
}

// ===============================================
// SECTION 1: MIDDLEWARE & CONFIGURATION
// ===============================================

// Security headers + compression
// Configure Content Security Policy to allow trusted CDNs used by the app
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"] ,
            scriptSrc: ["'self'", 'https://cdn.tailwindcss.com', 'https://unpkg.com', 'https://cdnjs.cloudflare.com'],
            styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
            imgSrc: ["'self'", 'https:', 'data:'],
            fontSrc: ["'self'", 'https:', 'data:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            // keep upgrade-insecure-requests
            'upgrade-insecure-requests': []
        }
    }
}));
app.use(compression());

// Override/ensure a permissive-enough Content-Security-Policy for our debug/dev environment.
// Helmet's CSP configuration sometimes results in a stricter header depending on version.
// This explicit header allows the CDNs and external image hosts used by the site.
app.use((req, res, next) => {
    const csp = "default-src 'self'; " +
        "script-src 'self' https://cdn.tailwindcss.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://checkout.razorpay.com 'unsafe-inline'; " +
        "style-src 'self' https: 'unsafe-inline'; " +
        "img-src 'self' https: data:; " +
        "font-src 'self' https: data:; " +
        "connect-src 'self' https: wss:; " +
        "frame-src https://api.razorpay.com https://checkout.razorpay.com; " +
        "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests";
    res.setHeader('Content-Security-Policy', csp);
    next();
});

// CORS configuration
app.use(cors({ 
    origin: process.env.CORS_ORIGIN || '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', 
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true // allow cookies to be sent
}));

// Parse cookies
app.use(cookieParser());

// Body parser middleware - configure to NOT parse multipart/form-data
// Multer will handle multipart requests instead
// Use the type option to explicitly exclude multipart/form-data
app.use(express.json({ 
    limit: '10mb',
    type: (req) => {
        const contentType = req.headers['content-type'] || '';
        // Don't parse multipart/form-data with JSON parser
        return !contentType.includes('multipart/form-data');
    }
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    type: (req) => {
        const contentType = req.headers['content-type'] || '';
        // Don't parse multipart/form-data with urlencoded parser
        return !contentType.includes('multipart/form-data');
    }
}));

// Error handler for body parser errors
// This catches any JSON parse errors from requests
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('[BODYPARSER-ERROR] JSON parse error:', err.message);
        return res.status(400).json({ error: 'Invalid JSON format' });
    }
    // Pass other errors to the next error handler
    next(err);
});

// Logging: morgan in dev, morgan->winston in prod
if (process.env.NODE_ENV === 'production') {
    const logger = winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [new winston.transports.Console()]
    });
    app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
} else {
    app.use(morgan('dev'));
}

// Session configuration using Sequelize store for persistence
const sessionStore = new SequelizeStore({ db: sequelize });
app.use(session({
    secret: process.env.SESSION_SECRET || 'session-secret-change-in-production',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: process.env.NODE_ENV === 'production',
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    }
}));

// Ensure session table exists
sessionStore.sync();

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===============================================
// SECTION 2: STATIC FILE SERVING
// ===============================================

// Serve static files from public directory with aggressive caching for assets
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Serve uploaded files from storage directory
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// ===============================================
// SECTION 3: API ROUTES WITH SMART RATE LIMITING
// ===============================================

// Apply authentication limiter to login/signup endpoints (strict)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/admin/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Contact form: strict per-IP limit to stop spam (5 messages / 15 min)
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => `contact:${req.ip}`,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ message: 'Too many messages sent. Please try again later.' })
});
app.use('/api/contact', contactLimiter);

// Apply public browsing limiter to read-only endpoints (very permissive)
app.use('/api/products', publicBrowsingLimiter);
app.use('/api/categories', publicBrowsingLimiter);

// Apply write operation limiter to cart modifications
app.use('/api/cart', (req, res, next) => {
    // GET requests for viewing cart use browsing limiter
    if (req.method === 'GET') {
        return publicBrowsingLimiter(req, res, next);
    }
    // POST, PUT, DELETE use write operation limiter
    return writeOperationLimiter(req, res, next);
});

// Apply write operation limiter to orders
app.use('/api/orders', writeOperationLimiter);

// Apply payment limiter to payment endpoints (moderate)
app.use('/api/payment', paymentLimiter);

// Apply write operation limiter to remaining endpoints
app.use('/api/coupons', writeOperationLimiter);
app.use('/api/analytics', writeOperationLimiter);

// Mount route handlers
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes); 
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/users', wishlistRoutes);
app.use('/api', wishlistRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/contact', contactRoutes);

// Development routes (only in development mode)
if (process.env.NODE_ENV === 'development') {
    const devRoutes = require('./routes/devRoutes');
    app.use('/dev', devRoutes);
}

// Healthcheck endpoint for readiness/liveness probes
app.get('/health', async (req, res) => {
    const { DB_TYPE } = require('./config/database');
    const status = {
        uptime: process.uptime(),
        env: process.env.NODE_ENV || 'development',
        dbType: DB_TYPE,
        jwtSecretSet: !!process.env.JWT_SECRET,
        sessionSecretSet: !!process.env.SESSION_SECRET
    };

    // For SQL-only mode we assume DB health is true if DB_TYPE is set; detailed checks are handled during startup
    res.status(200).json({ healthy: true, status });
});

// Debug endpoint to check database connectivity and product count
app.get('/debug/db-check', async (req, res) => {
    try {
        const { DB_TYPE, sequelize } = require('./config/database');
        const Product = require('./models/Product');
        const Order = require('./models/Order');
        const User = require('./models/User');
        
        // Test database connection
        await sequelize.authenticate();
        
        // Get counts
        const productCount = await Product.count();
        const orderCount = await Order.count();
        const userCount = await User.count();
        
        // Get sample product
        const sampleProduct = await Product.findOne();
        
        res.json({
            database: DB_TYPE,
            connected: true,
            tables: {
                products: productCount,
                orders: orderCount,
                users: userCount
            },
            sampleProduct: sampleProduct ? sampleProduct.toJSON ? sampleProduct.toJSON() : sampleProduct : null
        });
    } catch (error) {
        console.error('Debug check error:', error);
        res.status(500).json({
            error: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
        });
    }
});

// ===============================================
// SECTION 4: ADMIN ROUTES (Server-Side Rendered)
// ===============================================

// Admin login page
app.get('/adminlogin', (req, res) => {
    res.render('adminlogin', { title: 'Admin Login - Nanshhuf' });
});

// Admin dashboard page (client-side authentication via JavaScript)
app.get('/admindashboard', (req, res) => {
    res.render('admindashboard', { 
        title: 'Admin Dashboard - Nanshhuf'
    });
});

// Logout route - clears the auth cookie
app.post('/api/auth/logout', (req, res) => {
    // Clear the JWT cookie
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    // Also destroy server session if present
    if (req.session) {
        req.session.destroy(() => {});
    }
    res.json({ success: true, message: 'Logged out' });
});

// ===============================================
// SECTION 5: PUBLIC PAGE ROUTES (Server-Side Rendered)
// ===============================================

// Home page
app.get('/', async (req, res) => {
    try {
        // Fetch featured products server-side so the homepage renders them even if client-side JS has issues
        let featuredProducts = await Product.findAll({
            where: { featured: true, stock: { [Op.gt]: 0 } },
            limit: 8,
            order: [['createdAt', 'DESC']]
        });
        // Convert Sequelize instances to plain objects so templates can access fields reliably
        featuredProducts = featuredProducts.map(p => (typeof p.toJSON === 'function' ? p.toJSON() : p));
        res.render('index', { 
            title: 'Nanshhuf - Premium Frozen Food Solutions',
            user: req.session.user || null,
            featuredProducts
        });
    } catch (err) {
        console.error('Error fetching featured products for server-side render:', err);
        res.render('index', { 
            title: 'Nanshhuf - Premium Frozen Food Solutions',
            user: req.session.user || null,
            featuredProducts: []
        });
    }
});

app.get('/home', (req, res) => {
    res.redirect('/');
});

// Products page
app.get('/products', (req, res) => {
    res.render('products', { 
        title: 'Products - Nanshhuf',
        user: req.session.user || null
    });
});

// Product details page
app.get('/product/:id', (req, res) => {
    res.render('product-details', { 
        title: 'Product Details - Nanshhuf', 
        productId: req.params.id,
        user: req.session.user || null
    });
});

// Shopping cart
app.get('/cart', async (req, res) => {
    try {
        // Get user cart (both logged-in and session-based)
        let cartItems = [];
        
        if (req.session.user) {
            // User is logged in, get cart from DB
            const Cart = require('./models/Cart');
            const sqlCart = await Cart.findOne({ where: { userId: req.session.user.id } });
            if (sqlCart && sqlCart.items && sqlCart.items.length > 0) {
                cartItems = sqlCart.items;
            }
        } else if (req.session.cart && req.session.cart.items && req.session.cart.items.length > 0) {
            // User is not logged in, get cart from session
            cartItems = req.session.cart.items;
        }

        // If cart has items, fetch related products based on categories
        let relatedProducts = [];
        if (cartItems.length > 0) {
            // Get unique categories from cart items
            const productIds = cartItems.map(item => item.productId || item.product);
            const Products = require('./models/Product');
            
            // Fetch products from the database to get their categories
            const cartProducts = await Products.findAll({ 
                where: { id: { [Op.in]: productIds } },
                attributes: ['category'] 
            });
            
            // Get unique categories from cart products
            const categories = [...new Set(cartProducts.map(p => p.category).filter(Boolean))];
            
            if (categories.length > 0) {
                // Get random products from the same categories but exclude items already in cart
                const excludeProductIds = productIds.map(id => parseInt(id));
                
                relatedProducts = await Products.findAll({
                    where: {
                        category: { [Op.in]: categories },
                        id: { [Op.notIn]: excludeProductIds },
                        stock: { [Op.gt]: 0 } // Only include products with stock
                    },
                    limit: 8, // Show up to 8 related products
                    order: sequelize.random() // Randomize the results
                });
                
                // Convert Sequelize instances to plain objects
                relatedProducts = relatedProducts.map(p => (typeof p.toJSON === 'function' ? p.toJSON() : p));
            }
        }

        res.render('cart', { 
            title: 'Shopping Cart - Nanshhuf',
            user: req.session.user || null,
            cartItems,
            relatedProducts
        });
    } catch (error) {
        console.error('Error rendering cart page:', error);
        res.render('cart', { 
            title: 'Shopping Cart - Nanshhuf',
            user: req.session.user || null,
            cartItems: [],
            relatedProducts: []
        });
    }
});

// Checkout page
app.get('/checkout', (req, res) => {
    res.render('checkout', { 
        title: 'Checkout - Nanshhuf',
        user: req.session.user || null
    });
});

// Order confirmation page
app.get('/order/:id', (req, res) => {
    res.render('order-confirmation', { 
        title: 'Order Confirmation - Nanshhuf',
        user: req.session.user || null,
        orderId: req.params.id
    });
});

// About pages
app.get('/about', (req, res) => {
    res.render('about', { 
        title: 'About Us - Nanshhuf',
        user: req.session.user || null
    });
});

app.get('/whyfrozen', (req, res) => {
    res.render('whyfrozen', { 
        title: 'Why Buy Frozen Food - Nanshhuf',
        user: req.session.user || null
    });
});

app.get('/myths', (req, res) => {
    res.render('myths', { 
        title: 'Frozen Food Myths - Nanshhuf',
        user: req.session.user || null
    });
});

// Contact page
app.get('/contact', (req, res) => {
    res.render('contact', { 
        title: 'Contact Us - Nanshhuf',
        user: req.session.user || null
    });
});

// Auth pages
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/profile');
    }
    res.render('login-full', { 
        title: 'Login - Nanshhuf',
        user: null
    });
});

// Password reset page
app.get('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    res.render('reset-password', { 
        title: 'Reset Password - Nanshhuf',
        token: token,
        user: req.session.user || null
    });
});

// Password reset page (alternative route without token in URL)
app.get('/reset-password', (req, res) => {
    const token = req.query.token;
    res.render('reset-password', { 
        title: 'Reset Password - Nanshhuf',
        token: token || '',
        user: req.session.user || null
    });
});

// User profile page
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('profile', { 
        title: 'My Profile - Nanshhuf',
        user: req.session.user
    });
});

// Wishlist page
app.get('/wishlist', (req, res) => {
    res.render('wishlist', { 
        title: 'Wishlist - Nanshhuf',
        user: req.session.user || null
    });
});

// My Orders page
app.get('/myorders', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('myorders', { 
        title: 'My Orders - Nanshhuf',
        user: req.session.user
    });
});

// Policy pages
app.get('/privacy', (req, res) => {
    res.render('privacy', { 
        title: 'Privacy Policy - Nanshhuf',
        user: req.session.user || null
    });
});

app.get('/return', (req, res) => {
    res.render('return', { 
        title: 'Return Policy - Nanshhuf',
        user: req.session.user || null
    });
});

// Serve EJS partials or view fragments for SPA router requests like /views/home-content.html
// This allows client-side SPA navigation to fetch only the inner HTML fragments stored as EJS
app.get('/views/:viewName', (req, res) => {
    const viewFile = req.params.viewName; // e.g. 'home-content.html' or 'products.html'
    if (!viewFile || !viewFile.endsWith('.html')) return res.status(400).send('Bad request');
    const name = viewFile.replace(/\.html$/, '');

    // Try rendering partials/<name>.ejs first (used for home-content), then fall back to <name>.ejs
    res.render(`partials/${name}`, { user: req.session.user || null }, (err, html) => {
        if (!err && html) return res.send(html);

        // Fallback to rendering top-level view (may include header/footer - used for some pages)
        res.render(name, { user: req.session.user || null }, (err2, html2) => {
            if (!err2 && html2) return res.send(html2);
            // If neither exists, respond 404 so SPA router shows its error message
            res.status(404).send('Not Found');
        });
    });
});

// 404 catch-all route
app.get('*', (req, res) => {
    res.status(404).render('index', { 
        title: 'Page Not Found - Nanshhuf',
        user: req.session.user || null,
        error: '404 - Page Not Found'
    });
});



// ===============================================
// SECTION 6: DATABASE & SERVER START
// ===============================================

// Start server
async function startServer() {
    // Try to connect to database
    const connected = await connectDatabase();
    
    if (!connected) {
        console.warn('⚠️  Server starting without database connection.');
    }
    
    // Start listening regardless of database connection, but handle common listen errors
    const server = app.listen(PORT, () => {
        console.log('='.repeat(50));
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📊 Database Type: ${DB_TYPE.toUpperCase()}`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log('='.repeat(50));
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            logger.error(`⛔ Port ${PORT} is already in use. Another process may be running.`);
        } else {
            logger.error('Server error: %o', err);
        }
        process.exit(1);
    });

}

// Use central error handler as the last middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await closeConnections();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    await closeConnections();
    process.exit(0);
});

// Global error handlers
process.on('uncaughtException', (err) => {
    logger.error('uncaughtException: %o', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection: %o', reason);
    process.exit(1);
});

// Set up periodic cleanup of stuck payment orders every 30 minutes
if (process.env.NODE_ENV !== 'test') { // Don't run in test environment
    // Run cleanup immediately on startup
    paymentController.cleanupStuckPaymentOrders().catch(err => {
        console.error('Error during initial cleanup of stuck payment orders:', err);
    });
    
    // Then run cleanup every 30 minutes
    setInterval(async () => {
        try {
            const cleanedCount = await paymentController.cleanupStuckPaymentOrders();
            console.log(`Periodic cleanup completed. ${cleanedCount} stuck payment orders cleaned up.`);
        } catch (error) {
            console.error('Error during periodic cleanup of stuck payment orders:', error);
        }
    }, 30 * 60 * 1000); // Every 30 minutes
}

// Initialize server if executed directly
if (require.main === module) {
    startServer().catch(err => {
        logger.error('Failed to start server: %o', err);
        process.exit(1);
    });
}

module.exports = app;