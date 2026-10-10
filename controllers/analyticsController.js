const { DB_TYPE } = require('../config/database');
let Order = require('../models/Order');
let Product = require('../models/Product');
let User = require('../models/User');
let Coupon = require('../models/Coupon');

if (DB_TYPE === 'mysql' || DB_TYPE === 'postgresql' || DB_TYPE === 'sqlite') {
    const sqlModels = require('../models/sql');
    Order = sqlModels.Order;
    Product = sqlModels.Product;
    User = sqlModels.User;
    Coupon = sqlModels.Coupon;
}

// Get dashboard metrics
exports.getDashboardMetrics = async (req, res) => {
    try {
        // Get date range from query params (default to last 30 days)
        const days = parseInt(req.query.days) || 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const isSqlDialect = DB_TYPE === 'mysql' || DB_TYPE === 'postgresql' || DB_TYPE === 'sqlite';

        // Prepare common variables
        let dbSumResult = 0;
        let totalRevenueJs = 0;
        let matchedOrdersCount = 0;
        let sampleOrders = [];

        if (isSqlDialect) {
            const { Op, fn, col, where } = require('sequelize');
            const successStatuses = ['delivered', 'shipped', 'processing', 'paid'];
            const paymentCompletedWhere = where(fn('LOWER', col('paymentStatus')), 'completed');
            const statusWhere = where(fn('LOWER', col('status')), { [Op.in]: successStatuses });

            const sumWhere = {
                createdAt: { [Op.between]: [startDate, endDate] },
                [Op.or]: [paymentCompletedWhere, statusWhere]
            };

            // DB SUM
            dbSumResult = await Order.sum('totalAmount', { where: sumWhere });

            // Diagnostics: sample matching orders and count
            sampleOrders = await Order.findAll({ where: sumWhere, limit: 10, attributes: ['id', 'totalAmount', 'paymentStatus', 'status', 'createdAt'] });
            matchedOrdersCount = await Order.count({ where: sumWhere });

            // JS fallback sum
            const ordersForSum = await Order.findAll({ where: sumWhere, attributes: ['totalAmount'] });
            totalRevenueJs = ordersForSum.reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);
        }

        // New orders count
        let newOrdersCount = 0;
        if (isSqlDialect) {
            const { Op } = require('sequelize');
            newOrdersCount = await Order.count({ where: { createdAt: { [Op.between]: [startDate, endDate] } } });
        }

        // New customers count
        let newCustomersCount = 0;
        if (isSqlDialect) {
            const { Op } = require('sequelize');
            newCustomersCount = await User.count({ where: { createdAt: { [Op.between]: [startDate, endDate] } } });
        }

        // Pending orders count
        let pendingOrdersCount = 0;
        if (isSqlDialect) {
            const { Op, fn, col, where } = require('sequelize');
            const pendingStatuses = ['pending', 'processing'];
            pendingOrdersCount = await Order.count({ where: where(fn('LOWER', col('status')), { [Op.in]: pendingStatuses }) });
        }

        // Top selling products (SQL fallback via JS aggregation)
        let topSellingProducts = [];
        if (isSqlDialect) {
            const results = await Order.findAll();
            const counts = {};
            results.forEach(o => {
                try {
                    const items = o.items || [];
                    items.forEach(it => {
                        const pid = String(it.product);
                        counts[pid] = counts[pid] || { totalSold: 0, totalRevenue: 0 };
                        counts[pid].totalSold += Number(it.quantity || 0);
                        counts[pid].totalRevenue += Number((it.price || 0) * (it.quantity || 0));
                    });
                } catch (e) {}
            });
            topSellingProducts = Object.keys(counts).map(k => ({ product: k, ...counts[k] })).sort((a,b) => b.totalSold - a.totalSold).slice(0,5);
        }

        // Order status distribution
        let orderStatusDistribution = [];
        if (isSqlDialect) {
            const results = await Order.findAll({ attributes: ['status'] });
            const map = {};
            results.forEach(r => { const s = (r.status || '').toString(); map[s] = (map[s] || 0) + 1; });
            orderStatusDistribution = Object.keys(map).map(k => ({ _id: k, count: map[k] }));
        }

        // Return diagnostics plus metrics. totalRevenue prefers DB sum but include JS fallback for comparison.
        return res.json({
            totalRevenue: Number(dbSumResult || totalRevenueJs || 0),
            dbSumResult,
            matchedOrdersCount,
            sampleOrders,
            totalRevenueJs,
            newOrdersCount,
            newCustomersCount,
            pendingOrdersCount,
            topSellingProducts,
            orderStatusDistribution
        });
    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        res.status(500).json({ message: 'Server error while fetching dashboard metrics', error: error.message });
    }
};

// Get sales analytics
exports.getSalesAnalytics = async (req, res) => {
    try {
        // Get date range from query params
        const period = req.query.period || 'monthly'; // daily, weekly, monthly, yearly
        const endDate = new Date();
        let startDate = new Date();

        // Set start date based on period
        if (period === 'daily') {
            startDate.setDate(endDate.getDate() - 30); // Last 30 days
        } else if (period === 'weekly') {
            startDate.setDate(endDate.getDate() - 90); // Last 90 days
        } else if (period === 'yearly') {
            startDate.setFullYear(endDate.getFullYear() - 1); // Last year
        } else { // monthly (default)
            startDate.setMonth(endDate.getMonth() - 12); // Last 12 months
        }

        // Group sales by chosen period
        let dateFormat;
        if (period === 'daily') {
            dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        } else if (period === 'weekly') {
            dateFormat = { 
                $dateToString: { 
                    format: "%Y-W%V", // Year and Week number
                    date: { $dateFromParts: { year: { $year: "$createdAt" }, week: { $week: "$createdAt" } } } 
                } 
            };
        } else if (period === 'yearly') {
            dateFormat = { $dateToString: { format: "%Y", date: "$createdAt" } };
        } else { // monthly (default)
            dateFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        }

        // SQL fallback: fetch orders and group in JS
        if (DB_TYPE === 'mysql' || DB_TYPE === 'postgresql' || DB_TYPE === 'sqlite') {
            const { Op, fn, col, where } = require('sequelize');
            const successStatuses = ['delivered', 'shipped', 'processing', 'paid'];
            const statusWhere = where(fn('LOWER', col('status')), { [Op.in]: successStatuses });
            const paymentCompletedWhere = where(fn('LOWER', col('paymentStatus')), 'completed');
            const orders = await Order.findAll({ where: { createdAt: { [Op.between]: [startDate, endDate] }, [Op.or]: [paymentCompletedWhere, statusWhere] } });

            const getKey = (date) => {
                const d = new Date(date);
                const y = d.getFullYear();
                const m = d.getMonth() + 1;
                const day = d.getDate();
                if (period === 'daily') return `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                if (period === 'weekly') {
                    // ISO week number
                    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                    const dayNum = tmp.getUTCDay() || 7;
                    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
                    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
                    const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1)/7);
                    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`;
                }
                if (period === 'yearly') return `${y}`;
                return `${y}-${String(m).padStart(2,'0')}`; // monthly
            };

            const map = {};
            for (const o of orders) {
                const key = getKey(o.createdAt);
                if (!map[key]) map[key] = { totalSales: 0, orderCount: 0 };
                const amt = Number(o.totalAmount || 0);
                map[key].totalSales += amt;
                map[key].orderCount += 1;
            }

            const salesData = Object.keys(map).sort().map(k => ({ _id: k, totalSales: map[k].totalSales, orderCount: map[k].orderCount, avgOrderValue: map[k].orderCount ? (map[k].totalSales / map[k].orderCount) : 0 }));

            return res.json({ salesData, period, dateRange: { start: startDate, end: endDate } });
        }

        const salesData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ['Delivered', 'Shipped', 'Processing'] }
                }
            },
            {
                $group: {
                    _id: dateFormat,
                    totalSales: { $sum: "$totalAmount" },
                    orderCount: { $sum: 1 },
                    avgOrderValue: { $avg: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({ salesData, period, dateRange: { start: startDate, end: endDate } });
    } catch (error) {
        console.error('Error fetching sales analytics:', error);
        res.status(500).json({ message: 'Server error while fetching sales analytics', error: error.message });
    }
};

// Get customer analytics
exports.getCustomerAnalytics = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        if (DB_TYPE === 'mysql' || DB_TYPE === 'postgresql' || DB_TYPE === 'sqlite') {
            const { Op } = require('sequelize');
            const users = await User.findAll({ where: { createdAt: { [Op.between]: [startDate, endDate] } } });
            const map = {};
            users.forEach(u => {
                const key = new Date(u.createdAt).toISOString().slice(0,10);
                map[key] = (map[key] || 0) + 1;
            });
            const newCustomers = Object.keys(map).sort().map(k => ({ _id: k, count: map[k] }));

            const totalCustomers = await User.count();

            const orders = await Order.findAll({ attributes: ['userId'] });
            const uniqueUsers = new Set((orders || []).map(o => o.userId));
            const customersWithOrdersCount = uniqueUsers.size;

            return res.json({ newCustomers, totalCustomers, customersWithOrders: customersWithOrdersCount, newCustomersCount: newCustomers.reduce((sum, day) => sum + day.count, 0) });
        }

        // New customers over time (Mongo)
        const newCustomers = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Total customers
        let totalCustomers = 0;
        if (DB_TYPE === 'mysql' || DB_TYPE === 'postgresql' || DB_TYPE === 'sqlite') {
            totalCustomers = await User.count();
        } else {
            // Mongoose fallback
            totalCustomers = await User.countDocuments();
        }

        // Customers with orders
        const customersWithOrders = await Order.aggregate([
            {
                $group: {
                    _id: "$user"
                }
            }
        ]);

        const customersWithOrdersCount = customersWithOrders.length;

        res.json({ newCustomers, totalCustomers, customersWithOrders: customersWithOrdersCount, newCustomersCount: newCustomers.reduce((sum, day) => sum + day.count, 0) });
    } catch (error) {
        console.error('Error fetching customer analytics:', error);
        res.status(500).json({ message: 'Server error while fetching customer analytics', error: error.message });
    }
};

// Get product performance analytics
exports.getProductAnalytics = async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        if (DB_TYPE === 'mysql' || DB_TYPE === 'postgresql' || DB_TYPE === 'sqlite') {
            // SQL fallback: iterate orders and aggregate
            const { Op, fn, col, where } = require('sequelize');
            const successStatuses = ['delivered', 'shipped', 'processing', 'paid'];
            const statusWhere = where(fn('LOWER', col('status')), { [Op.in]: successStatuses });
            const paymentCompletedWhere = where(fn('LOWER', col('paymentStatus')), 'completed');
            const orders = await Order.findAll({ where: { createdAt: { [Op.between]: [startDate, endDate] }, [Op.or]: [paymentCompletedWhere, statusWhere] } });
            const counts = {};
            for (const o of orders) {
                const items = o.items || [];
                for (const it of items) {
                    const pid = String(it.product || it.productId);
                    counts[pid] = counts[pid] || { totalSold: 0, totalRevenue: 0 };
                    counts[pid].totalSold += Number(it.quantity || 0);
                    counts[pid].totalRevenue += Number((it.price || 0) * (it.quantity || 0));
                }
            }
            const topSellingProducts = Object.keys(counts).map(k => ({ product: k, ...counts[k] })).sort((a,b) => b.totalRevenue - a.totalRevenue).slice(0,10);

            // Products by category - best effort using Product table
            const prodMap = {};
            for (const p of await Product.findAll()) {
                prodMap[String(p.id || p._id)] = p;
            }
            const catMap = {};
            for (const pid of Object.keys(counts)) {
                const p = prodMap[pid];
                const cat = p ? p.category || p.categoryId || 'uncategorized' : 'unknown';
                catMap[cat] = catMap[cat] || { totalRevenue: 0, totalSold: 0 };
                catMap[cat].totalRevenue += counts[pid].totalRevenue;
                catMap[cat].totalSold += counts[pid].totalSold;
            }
            const productsByCategory = Object.keys(catMap).map(k => ({ category: k, ...catMap[k] })).sort((a,b) => b.totalRevenue - a.totalRevenue);

            return res.json({ topSellingProducts, productsByCategory });
        }

        // Mongo pipelines
        const topSellingProducts = await Order.aggregate([
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ['Delivered', 'Shipped', 'Processing'] }
                }
            },
            {
                $group: {
                    _id: "$items.product",
                    name: { $first: { $arrayElemAt: ["$productDetails.name", 0] } },
                    imageUrl: { $first: { $arrayElemAt: ["$productDetails.imageUrl", 0] } },
                    category: { $first: { $arrayElemAt: ["$productDetails.category", 0] } },
                    totalSold: { $sum: "$items.quantity" },
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        // Products by category performance
        const productsByCategory = await Order.aggregate([
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ['Delivered', 'Shipped', 'Processing'] }
                }
            },
            {
                $group: {
                    _id: { $arrayElemAt: ["$productDetails.category", 0] },
                    totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                    totalSold: { $sum: "$items.quantity" }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        res.json({ topSellingProducts, productsByCategory });
    } catch (error) {
        console.error('Error fetching product analytics:', error);
        res.status(500).json({ message: 'Server error while fetching product analytics', error: error.message });
    }
};