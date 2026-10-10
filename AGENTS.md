# Copilot Instructions for Nanshhuf E-Commerce Platform

## ⚠️ CRITICAL RULE: Documentation Management

**DO NOT create multiple new documentation files.** This platform has excessive documentation already.
- Focus on FIXING CODE, not writing about fixes & don't create unnecessary documentations for expliaing each and evry step and unnecessary things. 
- Update existing docs only when necessary
- Maximum 1 new doc per sprint
- Prioritize working code over perfect documentation
- Use inline comments in code instead of separate docs
- If you come around error or issues while reading, fixing or manipulating code, then inform user and fix the issues. 
- Act intelligentl while implementing or working on things mentioned, make sure to make it end-to-end & production ready.
- Remove redundant code, files, folders that you created after execution or if not needed anymore. 
- Never run "npm run dev", because it is already running in the background, when you run it again you crash down the already running one. If you find the server is not running, then chcek first before running another one.


---

## 📋 Overview

**Nanshhuf** is a full-stack, server-side rendered e-commerce platform for frozen food products. Built with **Node.js/Express**, **Sequelize ORM**, and **EJS templates**. The architecture emphasizes a **SQL-first, database-agnostic** design that supports SQLite (dev), MySQL, and PostgreSQL.

**Key principle**: Data access flows through centralized Sequelize models → controllers → routes. No direct database queries in views.

---

## 🏗️ Architecture & Data Flow

### Database Layer (Single Source of Truth: SQL)
- **Location**: `server/config/database.js`
- **Pattern**: Sequelize ORM with dynamic dialect selection (`DB_TYPE` env var)
- **Models centralization**: `server/models/sql/index.js` imports and initializes all 8 models
- **Critical**: All models are factory functions that accept `sequelize` instance
- **Associations**: Product→Category, Cart→User, Order→User, Notification→User (defined in sql/index.js)

**Database selection flow**:
```
process.env.DB_TYPE → 'sqlite' (default) | 'mysql' | 'postgresql'
→ sequelize instance configured accordingly
→ Models initialized with same sequelize
```

### Service Boundaries (8 Core Models)
| Model | Key Fields | Hooks | Associations |
|-------|-----------|-------|--------------|
| **User** | id, name, email, password, phone, address | bcrypt hash beforeCreate/beforeUpdate | hasMany: Cart, Order, Notification |
| **Product** | id, name, price, discount, stock, category, featured | N/A | belongsTo: Category |
| **Category** | id, name, slug | N/A | hasMany: Product |
| **Cart** | id, userId, items (JSON), total | N/A | belongsTo: User |
| **Order** | id, userId, items, total, status | N/A | belongsTo: User |
| **Coupon** | id, code, discountPercent, expiryDate, maxUses | N/A | N/A |
| **Admin** | id, email, password, role | bcrypt hash beforeCreate/beforeUpdate | N/A |
| **Notification** | id, userId, message, type, read | N/A | belongsTo: User |

### Request Flow Example: Product Listing
```
GET /api/products?category=frozen&minPrice=100&sort=price_asc
  ↓
productController.getAllProducts() [server/controllers/productController.js]
  ↓
Parse query params → Build Sequelize where/order clauses using Op operators
  ↓
Product.findAll({ where, order, offset, limit })
  ↓
JSON response to client
```

**Critical**: Sequelize `Op` operators replace MongoDB operators. Use `Op.gte`, `Op.lte`, `Op.in`, etc.

---

## 🔐 Authentication & Authorization

### Auth Middleware Flow
- **Location**: `server/middleware/authMiddleware.js`
- **Token sources** (priority order): Authorization Bearer header → `token` cookie
- **JWT verification**: Decodes token, fetches user via `User.findByPk()`, excludes password via Sequelize `attributes`

**Two middleware functions**:
1. **`isLoggedIn`**: Validates user token, attaches `req.user` (excludes password)
2. **`isAdminLoggedIn`**: Validates admin token, checks `role === 'admin'`, attaches `req.admin`

### Session Management
- **Framework**: `express-session` with `SequelizeStore` for persistence
- **Cookie settings**: `{ httpOnly: true, secure: production, sameSite: 'lax' }`
- **Session vs JWT**: Session used server-side for rendering context; JWT for API auth

**Auth flow**:
```
POST /api/auth/login { email, password }
  ↓ [authController.loginUser]
Find user → bcrypt.compare password → Create JWT → Set cookie + session
  ↓
Response includes token for subsequent API calls
```

---

## 🗂️ Project Structure & Key Files

### Controllers (`server/controllers/`)
Each controller imports models from `server/models/sql` and exports route handlers:
- **authController**: User signup/login, admin login, profile management
- **productController**: CRUD operations, filtering, pagination, featured products
- **cartController**: Add/remove items, merge session cart with DB cart on login
- **orderController**: Create orders, order history, order status tracking
- **categoryController**: Category CRUD, product-category associations
- **couponController**: Coupon validation, usage tracking
- **analyticsController**: Sales reports, user metrics

**Pattern**:
```javascript
// Top of file
const sqlModels = require('../models/sql');
const Product = sqlModels.Product;

// In handler
const products = await Product.findAll({ where: {...}, order: [...] });
```

### Routes (`server/routes/`)
Named files match controller concerns. Route handlers are thin wrappers:
- `authRoutes.js`: POST /signup, /login, /admin/login, GET /profile, /verify, /logout
- `productRoutes.js`: GET /:id (details), GET (list with filters), POST (admin create)
- `cartRoutes.js`: POST (add), DELETE/:itemId, PUT/:itemId (update quantity)
- `orderRoutes.js`: POST (create), GET (list), GET/:id (details)

### Middleware (`server/middleware/`)
- **authMiddleware.js**: JWT verification (described above)
- **errorHandler.js**: Global error wrapper—logs via Winston, returns JSON with stack in dev only
- **upload.js**: Multer config for file uploads (photos→`storage/photos`, videos→`storage/videos`)

**File handling**:
```javascript
const { single, array } = require('./middleware/upload');

// In route
router.post('/upload', single('photo'), productController.handleUpload);
```

### Views (`server/views/`)
EJS templates with server-side rendering:
- **partials/header.ejs, partials/footer.ejs**: Reusable layout components
- **index.ejs**: Homepage (featured products, categories)
- **products.ejs**: Product listing with client-side filter UI
- **product-details.ejs**: Single product + reviews
- **cart.ejs, checkout.ejs, order-confirmation.ejs**: Checkout flow
- **admindashboard.ejs**: Admin panel (product/order/user management)
- **login.ejs, adminlogin.ejs**: Authentication forms

**Rendering context** (passed from server):
```javascript
res.render('index', { user: req.user, cart: sessionCart, categories });
```

### Storage (`server/storage/`)
- **photos/**: Product images (uploaded via multer)
- **videos/**: Product videos
- **Cleanup**: Scripts in `server/scripts/` manage backup/archival

---

## 🚀 Critical Developer Workflows

### Local Development
```powershell
# Terminal in server/ directory
npm install
npm run dev  # Runs with nodemon, watches for changes
```

**Env setup** (create `server/.env`):
```
NODE_ENV=development
DB_TYPE=sqlite
JWT_SECRET=your-dev-secret
SESSION_SECRET=your-session-secret
RAZORPAY_KEY_ID=test-key
RAZORPAY_KEY_SECRET=test-secret
PORT=3000
```

### Creating an Admin (one-time)
```powershell
node server/createadmin.js
# Prompts for email, password; creates User model instance with role='admin'
```

### Testing
```powershell
npm test  # Runs Jest (config: server/jest.config.js)
```
- Tests live in `server/tests/`
- Mock data generator: `server/utils/mockDataGenerator.js` (seedDatabase function)

### Deployment Checklist
See `DEPLOYMENT_CHECKLIST.md` for full details. Key steps:
1. Set `NODE_ENV=production`
2. Use MySQL/PostgreSQL (not SQLite)
3. Configure `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
4. Enable HTTPS (Helmet CSP configured for TLS)
5. Set strong `JWT_SECRET` and `SESSION_SECRET`
6. Monitor logs via Winston (`server/logs/`)

---

## 🎯 Common Patterns & Conventions

### Adding a New Route (Example: User Wishlist)
1. **Create model** → `server/models/sql/Wishlist.js` (factory function returning Sequelize.define)
2. **Register in sql/index.js** → Import, initialize, define association to User
3. **Create controller** → `server/controllers/wishlistController.js` with exports.addToWishlist, exports.removeFromWishlist
4. **Create route** → `server/routes/wishlistRoutes.js` importing controller and authMiddleware
5. **Mount in server.js** → `app.use('/api/wishlist', wishlistRoutes)`
6. **Create view** → `server/views/wishlist.ejs` for client-side rendering

### Adding a New Filter to Products
1. **Add field to Product model** → `server/models/sql/Product.js` (e.g., `glutenFree: Boolean`)
2. **Update productController.getAllProducts()** → Add query param parsing and Sequelize `Op` filter
3. **Update products.ejs** → Add filter checkbox/dropdown in UI
4. **Sync DB** → Server auto-runs `sequelize.sync({ alter: false })` on startup

### Handling Validation Errors
- **Express-validator** is installed but currently minimal usage
- **Pattern used**: Manual regex checks in controllers (e.g., email validation in authController)
- **Response**: `res.status(400).json({ message: 'Error description' })`
- **Global errors**: Caught by middleware/errorHandler.js

### File Uploads (Images/Videos)
- **Middleware**: `server/middleware/upload.js` exports `{ single(fieldName), array(fieldName) }`
- **Storage**: `/storage/photos/` and `/storage/videos/` (auto-created)
- **Limits**: 50MB per file
- **Allowed types**: .jpeg, .jpg, .png, .gif, .webp, .mp4, .mov, .avi, .wmv, .flv, .webm
- **Filename strategy**: `{fieldname}-{timestamp}-{randomNum}.{ext}`

### Cart Management (Session + DB Sync)
- **Session cart** (browser): `req.session.cart = { items: [], total: 0 }`
- **DB cart** (persistent): `Cart` model linked to User
- **On login**: Cart items merged from session → DB
- **Controllers**: cartController.js handles merge logic via `Cart.findOne({ where: { userId } })`

### Error Handling Strategy
```javascript
// Controllers wrap try-catch
try {
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Not found' });
    // Process...
} catch (error) {
    console.error('Operation failed:', error);
    res.status(500).json({ message: 'Server error' });
}
```
- **Logging**: Winston logger configured to console (dev) + files (prod)
- **Error handler** (middleware/errorHandler.js): Catches unhandled rejections, logs stack in dev

---

## ⚙️ Integration Points & External Dependencies

### Razorpay (Payment Processing)
- **Location**: `server/controllers/paymentController.js`
- **Env vars**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- **Flow**: Create order → User pays → Webhook validates payment → Create Order record

### Email Service
- **Location**: `server/controllers/emailController.js`
- **Use cases**: Order confirmation, password reset, promotional emails
- **Configuration**: See `RAZORPAY_INTEGRATION_GUIDE.md` for SMTP setup

### Rate Limiting
- **Framework**: `express-rate-limit`
- **Config in server.js**: 15-min window, 200 requests (prod) / 1000 requests (dev)
- **Applied to**: All routes via `app.use(limiter)`

### Security Headers
- **Helmet.js** configured with CSP for trusted CDNs:
  - Tailwind CSS CDN: `https://cdn.tailwindcss.com`
  - Unpkg: `https://unpkg.com`
  - Cloudflare CDN: `https://cdnjs.cloudflare.com`
- **HTTPS only** in production (secure cookies, upgrade-insecure-requests)

---

## 🔍 Debugging & Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "DB Connection Error" | Wrong `DB_TYPE` or missing credentials | Check .env: `DB_TYPE=sqlite` vs MySQL/PostgreSQL settings |
| "Not authorized" on login | JWT_SECRET mismatch | Ensure same secret in .env across instances |
| Cart not persisting | Session not synced to DB | Check `cartController.mergeSessionCart()` on login |
| File upload fails | Storage directory missing | Run `mkdir -p server/storage/{photos,videos}` |
| Template not rendering | Missing context variable | Check controller's `res.render()` call—compare with view templates |

### Logging
- **Development**: Console output via Winston (format: simple)
- **Production**: Files in `server/logs/` (error.log, combined.log) + console (for containers)
- **View logs**: `tail -f server/logs/combined.log`

### Database Schema Inspection
```powershell
# SQLite
sqlite3 database.sqlite ".schema"

# MySQL
mysql -u root -p nanshhuf
SHOW TABLES;
DESCRIBE users;
```

---

## 📚 Key Reference Files

- **Architecture decision**: `server/config/database.js` (SQL-first, dialect agnostic)
- **Model factory pattern**: `server/models/sql/User.js` (example with bcrypt hooks)
- **Associations**: `server/models/sql/index.js` (relationship definitions)
- **Auth flow**: `server/middleware/authMiddleware.js` → `server/controllers/authController.js`
- **Filter/sort patterns**: `server/controllers/productController.js` (Sequelize Op usage)
- **Deployment setup**: `DEPLOYMENT_CHECKLIST.md`, `CPANEL_SETUP_IMPLEMENTATION.md`
- **Test setup**: `server/jest.config.js`, `server/jest-mongodb-config.js`

---

## ✅ Before Making Changes

**Verify**:
- [ ] Understand data flow through models → controllers → routes
- [ ] Check if new feature requires model association (update sql/index.js if yes)
- [ ] Confirm Sequelize `Op` operators (not MongoDB syntax)
- [ ] Use centralized sql models (never require Mongoose or separate DB logic)
- [ ] Apply auth middleware to protected routes
- [ ] Test with both SQLite (dev) and MySQL (if production target)
- [ ] Validate file uploads use upload.js middleware
- [ ] Ensure error handling follows pattern (try-catch + JSON responses)

---

## 🤔 Questions for Clarification?

This guide covers discoverable patterns and critical workflows. For project-specific questions:
- Check **DOCUMENTATION_INDEX.md** for detailed feature docs
- Review **README.md** for full setup instructions
- See **DEPLOYMENT_CHECKLIST.md** for production readiness
