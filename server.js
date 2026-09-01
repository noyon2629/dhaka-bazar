const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============================================
// IN-MEMORY DATABASE
// ============================================
let users = [];
let products = [];
let orders = [];
let otpStore = new Map(); // Temporary store for OTPs

// Owner Session Memory Storage
const ownerSessions = new Map();

// Environment Variables
const OWNER_ID = process.env.OWNER_ID || "2629574242";
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || "DhakaBazar@2026#Owner";

// Helper functions
function cleanText(text) {
    return text ? String(text).trim() : "";
}

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
// SYSTEM & HEALTH ROUTES
// ============================================
app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        message: "Server is online and healthy.",
        timestamp: new Date().toISOString()
    });
});

// ============================================
// USER & AUTH ROUTES
// ============================================
app.post("/api/auth/request-otp", (req, res) => {
    const phone = cleanText(req.body.phone);
    const name = cleanText(req.body.name);

    if (!phone || phone.length < 10) {
        return res.status(400).json({ success: false, message: "সঠিক মোবাইল নম্বর দিন।" });
    }

    // Static OTP for testing/in-memory setup
    const generatedOTP = "123456";
    otpStore.set(phone, generatedOTP);

    res.json({
        success: true,
        message: "OTP পাঠানো হয়েছে (Demo OTP: 123456)"
    });
});

app.post("/api/auth/verify-otp", (req, res) => {
    const name = cleanText(req.body.name);
    const phone = cleanText(req.body.phone);
    const password = cleanText(req.body.password);
    const otp = cleanText(req.body.otp);

    const validOTP = otpStore.get(phone);

    if (!validOTP || validOTP !== otp) {
        return res.status(400).json({ success: false, message: "OTP সঠিক নয়।" });
    }

    otpStore.delete(phone);

    let user = users.find(u => u.phone === phone);
    if (!user) {
        user = {
            id: createId("CUST"),
            name,
            phone,
            password,
            role: "CUSTOMER",
            createdAt: new Date().toISOString()
        };
        users.push(user);
    }

    res.json({
        success: true,
        message: "Registration successful.",
        user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
    });
});

app.post("/api/auth/login", (req, res) => {
    const phone = cleanText(req.body.phone);
    const password = cleanText(req.body.password);

    const user = users.find(u => u.phone === phone && u.password === password);

    if (!user) {
        return res.status(401).json({ success: false, message: "মোবাইল নম্বর বা পাসওয়ার্ড ভুল।" });
    }

    res.json({
        success: true,
        message: "Login successful.",
        user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
    });
});

// ============================================
// PRODUCT ROUTES
// ============================================
app.get("/api/products", (req, res) => {
    res.json({ success: true, count: products.length, products });
});

app.post("/api/products", (req, res) => {
    const { sellerId, name, description, category, icon, price, stock, deliveryCharge } = req.body;

    if (!name || !price) {
        return res.status(400).json({ success: false, message: "Product name and price required." });
    }

    const newProduct = {
        id: createId("PROD"),
        sellerId: cleanText(sellerId),
        sellerName: cleanText(sellerId) || "Seller",
        name: cleanText(name),
        description: cleanText(description),
        category: cleanText(category) || "other",
        icon: cleanText(icon) || "📦",
        price: Number(price) || 0,
        stock: Number(stock) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        status: "ACTIVE",
        createdAt: new Date().toISOString()
    };

    products.push(newProduct);
    res.status(201).json({ success: true, message: "Product added successfully.", product: newProduct });
});

// ============================================
// ORDER ROUTES
// ============================================
app.post("/api/orders", (req, res) => {
    const phone = cleanText(req.body.phone);
    const deliveryAddress = cleanText(req.body.deliveryAddress);
    const items = req.body.items || [];

    if (!phone || !deliveryAddress || items.length === 0) {
        return res.status(400).json({ success: false, message: "অর্ডারের জন্য প্রয়োজনীয় তথ্য প্রদান করুন।" });
    }

    let productTotal = 0;
    let deliveryCharge = 0;
    const sellersSeen = new Set();

    const orderItems = items.map(item => {
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
            prod.stock = Math.max(0, prod.stock - item.quantity);
            productTotal += prod.price * item.quantity;

            if (!sellersSeen.has(prod.sellerId)) {
                deliveryCharge += prod.deliveryCharge;
                sellersSeen.add(prod.sellerId);
            }

            return {
                productId: prod.id,
                name: prod.name,
                price: prod.price,
                quantity: item.quantity
            };
        }
        return item;
    });

    const user = users.find(u => u.phone === phone);

    const newOrder = {
        id: createId("ORD"),
        customerName: user ? user.name : "Customer",
        phone,
        deliveryAddress,
        items: orderItems,
        productTotal,
        deliveryCharge,
        grandTotal: productTotal + deliveryCharge,
        paymentMethod: "CASH_ON_DELIVERY",
        status: "ORDER_CONFIRMED",
        createdAt: new Date().toISOString()
    };

    orders.push(newOrder);
    res.status(201).json({ success: true, message: "Order placed successfully.", order: newOrder });
});

app.get("/api/orders/customer/:phone", (req, res) => {
    const phone = req.params.phone;
    const customerOrders = orders.filter(o => o.phone === phone);
    res.json({ success: true, count: customerOrders.length, orders: customerOrders });
});

// ============================================
// OWNER API ROUTES
// ============================================
app.post("/api/owner/login", (req, res) => {
    const ownerId = cleanText(req.body.ownerId);
    const password = cleanText(req.body.password);

    if (ownerId !== OWNER_ID || password !== OWNER_PASSWORD) {
        return res.status(401).json({
            success: false,
            message: "Owner ID অথবা Password ভুল।"
        });
    }

    const token = crypto.randomBytes(32).toString("hex");
    ownerSessions.set(token, { ownerId, loginAt: new Date().toISOString() });

    res.json({
        success: true,
        message: "Owner Login Successful.",
        token,
        owner: { id: ownerId, role: "OWNER" }
    });
});

app.post("/api/owner/logout", ownerAuth, (req, res) => {
    const auth = req.headers.authorization || "";
    const token = auth.replace("Bearer ", "").trim();
    ownerSessions.delete(token);

    res.json({ success: true, message: "Owner logout successful." });
});

app.get("/api/owner/dashboard", ownerAuth, (req, res) => {
    const totalUsers = users.length;
    const buyerCount = users.filter(user => user.role === "CUSTOMER").length;
    const sellerCount = users.filter(user => user.role === "SELLER").length;

    const totalProducts = products.length;
    const activeProducts = products.filter(product => product.status === "ACTIVE").length;

    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(order => order.status === "DELIVERED").length;
    const cancelledOrders = orders.filter(order => order.status === "CANCELLED").length;
    const pendingOrders = orders.filter(order =>
        ["ORDER_CONFIRMED", "PROCESSING", "PACKED", "OUT_FOR_DELIVERY"].includes(order.status)
    ).length;

    let totalSales = 0;
    let deliveredSales = 0;

    orders.forEach(order => {
        const amount = Number(order.grandTotal) || 0;
        if (order.status !== "CANCELLED") {
            totalSales += amount;
        }
        if (order.status === "DELIVERED") {
            deliveredSales += amount;
        }
    });

    res.json({
        success: true,
        owner: { id: req.owner.ownerId, role: "OWNER" },
        dashboard: {
            users: { total: totalUsers, buyers: buyerCount, sellers: sellerCount },
            products: { total: totalProducts, active: activeProducts },
            orders: { total: totalOrders, pending: pendingOrders, delivered: deliveredOrders, cancelled: cancelledOrders },
            sales: { total: totalSales, delivered: deliveredSales }
        },
        generatedAt: new Date().toISOString()
    });
});

app.get("/api/owner/users", ownerAuth, (req, res) => {
    res.json({
        success: true,
        count: users.length,
        users: users.map(u => ({ id: u.id, name: u.name, phone: u.phone, role: u.role, createdAt: u.createdAt }))
    });
});

app.get("/api/owner/products", ownerAuth, (req, res) => {
    res.json({ success: true, count: products.length, products });
});

app.get("/api/owner/orders", ownerAuth, (req, res) => {
    res.json({ success: true, count: orders.length, orders });
});

// ============================================
// PAGE & FALLBACK ROUTES
// ============================================
app.get("/owner", (req, res) => {
    res.sendFile(path.join(__dirname, "owner.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API Route not found."
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
