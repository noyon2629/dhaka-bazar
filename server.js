const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============================================
// IN-MEMORY DATABASE (TEMPORARY DATA)
// ============================================
let users = [];
let products = [];
let orders = [];

// Owner Session Memory Storage
const ownerSessions = new Map();

// Environment Variables or Default Values
const OWNER_ID = process.env.OWNER_ID || "2629574242";
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || "DhakaBazar@2026#Owner";

// Helper function to sanitize text
function cleanText(text) {
    return text ? String(text).trim() : "";
}

// Helper function to generate IDs
function createId(prefix) {
    return prefix + "_" + Math.floor(100000 + Math.random() * 900000);
}

// ============================================
// OWNER AUTH MIDDLEWARE
// ============================================
function ownerAuth(req, res, next) {
    const auth = req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Owner login required."
        });
    }

    const token = auth.replace("Bearer ", "").trim();
    const session = ownerSessions.get(token);

    if (!session) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired owner session."
        });
    }

    req.owner = session;
    next();
}

// ============================================
// OWNER API ROUTES
// ============================================

// Owner Login
app.post("/api/owner/login", (req, res) => {
    const ownerId = cleanText(req.body.ownerId);
    const password = cleanText(req.body.password);

    if (!OWNER_PASSWORD) {
        return res.status(500).json({
            success: false,
            message: "OWNER_PASSWORD Render Environment-এ সেট করা হয়নি।"
        });
    }

    if (ownerId !== OWNER_ID || password !== OWNER_PASSWORD) {
        return res.status(401).json({
            success: false,
            message: "Owner ID অথবা Password ভুল।"
        });
    }

    const token = crypto.randomBytes(32).toString("hex");

    ownerSessions.set(token, {
        ownerId,
        loginAt: new Date().toISOString()
    });

    res.json({
        success: true,
        message: "Owner Login Successful.",
        token,
        owner: {
            id: ownerId,
            role: "OWNER"
        }
    });
});

// Owner Logout
app.post("/api/owner/logout", ownerAuth, (req, res) => {
    const auth = req.headers.authorization || "";
    const token = auth.replace("Bearer ", "").trim();

    ownerSessions.delete(token);

    res.json({
        success: true,
        message: "Owner logout successful."
    });
});

// Owner Dashboard Summary Data
app.get("/api/owner/dashboard", ownerAuth, (req, res) => {
    // USERS
    const totalUsers = users.length;
    const buyerCount = users.filter(user => user.role === "CUSTOMER").length;
    const sellerCount = users.filter(user => user.role === "SELLER").length;

    // PRODUCTS
    const totalProducts = products.length;
    const activeProducts = products.filter(product => product.status === "ACTIVE").length;

    // ORDERS
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(order => order.status === "DELIVERED").length;
    const cancelledOrders = orders.filter(order => order.status === "CANCELLED").length;
    const pendingOrders = orders.filter(order =>
        ["ORDER_CONFIRMED", "PROCESSING", "PACKED", "OUT_FOR_DELIVERY"].includes(order.status)
    ).length;

    // SALES
    let totalSales = 0;
    let deliveredSales = 0;

    orders.forEach(order => {
        const amount = Number(order.total) || 0;
        if (order.status !== "CANCELLED") {
            totalSales += amount;
        }
        if (order.status === "DELIVERED") {
            deliveredSales += amount;
        }
    });

    res.json({
        success: true,
        owner: {
            id: req.owner.ownerId,
            role: "OWNER"
        },
        dashboard: {
            users: {
                total: totalUsers,
                buyers: buyerCount,
                sellers: sellerCount
            },
            products: {
                total: totalProducts,
                active: activeProducts
            },
            orders: {
                total: totalOrders,
                pending: pendingOrders,
                delivered: deliveredOrders,
                cancelled: cancelledOrders
            },
            sales: {
                total: totalSales,
                delivered: deliveredSales
            }
        },
        generatedAt: new Date().toISOString()
    });
});

// Owner Data List Fetch APIs
app.get("/api/owner/users", ownerAuth, (req, res) => {
    res.json({
        success: true,
        count: users.length,
        users: users.map(u => ({
            id: u.id,
            name: u.name,
            phone: u.phone,
            role: u.role,
            createdAt: u.createdAt
        }))
    });
});

app.get("/api/owner/products", ownerAuth, (req, res) => {
    res.json({ success: true, count: products.length, products });
});

app.get("/api/owner/orders", ownerAuth, (req, res) => {
    res.json({ success: true, count: orders.length, orders });
});

// ============================================
// APP BUSINESS API ROUTES
// ============================================

// Seller Registration Endpoint
app.post("/api/sellers", (req, res) => {
    const name = cleanText(req.body.name);
    const phone = cleanText(req.body.phone);

    if (!name || !phone) {
        return res.status(400).json({
            success: false,
            message: "Seller name এবং phone প্রয়োজন।"
        });
    }

    const existing = users.find(user => user.phone === phone);

    if (existing) {
        if (existing.role === "SELLER") {
            return res.json({
                success: true,
                message: "Seller account already exists.",
                user: existing
            });
        }
        return res.status(409).json({
            success: false,
            message: "এই phone number দিয়ে Customer account আছে।"
        });
    }

    const seller = {
        id: createId("SELLER"),
        name,
        phone,
        role: "SELLER",
        createdAt: new Date().toISOString()
    };

    users.push(seller);

    res.status(201).json({
        success: true,
        message: "Seller account created successfully.",
        user: seller
    });
});

// ============================================
// ROOT & DASHBOARD ROUTE
// ============================================

// সরাসরি ডোমেইনে ঢুকলেই owner.html ওপেন হবে
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/owner.html");
});

// Default 404 Route
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API Route not found."
    });
});

// Server Listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
