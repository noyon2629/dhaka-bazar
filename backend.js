// ============================================
// DHAKA BAZAR - BACKEND API
// COD + SELLER + OWNER ADMIN DASHBOARD
// Version: 4.0
// ============================================

const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({ origin: "*" }));

app.use(express.json({ limit: "10mb" }));

// ============================================
// TEMPORARY DATABASE
// ============================================

const users = [];
const products = [];
const orders = [];

// ============================================
// OWNER SETTINGS
// ============================================

const OWNER_ID =
    process.env.OWNER_ID || "owner";

const OWNER_PASSWORD =
    process.env.OWNER_PASSWORD || "ChangeThisPassword123";

// ============================================
// HELPER
// ============================================

function createId(prefix) {
    return prefix + "-" + Date.now() + "-" +
        Math.floor(Math.random() * 10000);
}

function cleanText(value) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value).trim();
}

function validPrice(value) {
    const price = Number(value);
    return Number.isFinite(price) && price > 0;
}

function validDeliveryCharge(value) {
    const charge = Number(value);
    return Number.isFinite(charge) && charge >= 0;
}

// ============================================
// OWNER AUTH
// ============================================

function ownerAuth(req, res, next) {

    const ownerKey =
        req.headers["x-owner-key"];

    if (!ownerKey) {

        return res.status(401).json({
            success: false,
            message: "Owner authorization required."
        });

    }

    if (ownerKey !== OWNER_PASSWORD) {

        return res.status(403).json({
            success: false,
            message: "Owner authorization failed."
        });

    }

    next();
}

// ============================================
// HOME
// ============================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        app: "Dhaka Bazar",
        version: "4.0",
        payment: "CASH_ON_DELIVERY_ONLY",
        message: "Dhaka Bazar Backend is running!"
    });

});

// ============================================
// STATUS
// ============================================

app.get("/api/status", (req, res) => {

    res.json({
        success: true,
        status: "online",
        paymentMethod: "COD",
        serverTime: new Date().toISOString()
    });

});

// ============================================
// OWNER LOGIN
// ============================================

app.post("/api/admin/login", (req, res) => {

    const ownerId =
        cleanText(req.body.ownerId);

    const password =
        cleanText(req.body.password);

    if (
        ownerId !== OWNER_ID ||
        password !== OWNER_PASSWORD
    ) {

        return res.status(401).json({
            success: false,
            message: "Owner ID অথবা Password ভুল।"
        });

    }

    res.json({

        success: true,

        message:
            "Owner Login successful.",

        owner: {
            id: OWNER_ID,
            role: "OWNER"
        }

    });

});

// ============================================
// USER CREATE
// ============================================

app.post("/api/users", (req, res) => {

    const name =
        cleanText(req.body.name);

    const phone =
        cleanText(req.body.phone);

    if (!name || !phone) {

        return res.status(400).json({
            success: false,
            message:
                "নাম এবং মোবাইল নম্বর প্রয়োজন।"
        });

    }

    let user =
        users.find(
            item => item.phone === phone
        );

    if (user) {

        user.name = name;

        return res.json({
            success: true,
            message: "Account found.",
            user
        });

    }

    user = {

        id: createId("USER"),

        name,

        phone,

        role: "CUSTOMER",

        status: "ACTIVE",

        createdAt:
            new Date().toISOString()

    };

    users.push(user);

    res.status(201).json({

        success: true,

        message:
            "Account created successfully.",

        user

    });

});

// ============================================
// GET USER
// ============================================

app.get("/api/users/:phone", (req, res) => {

    const phone =
        cleanText(req.params.phone);

    const user =
        users.find(
            item => item.phone === phone
        );

    if (!user) {

        return res.status(404).json({

            success: false,

            message:
                "User পাওয়া যায়নি।"

        });

    }

    res.json({
        success: true,
        user
    });

});

// ============================================
// GET ALL USERS - OWNER
// ============================================

app.get(
    "/api/admin/users",
    ownerAuth,
    (req, res) => {

        res.json({

            success: true,

            count: users.length,

            users

        });

    }
);

// ============================================
// ADD PRODUCT
// ============================================

app.post("/api/products", (req, res) => {

    const sellerId =
        cleanText(req.body.sellerId);

    const sellerName =
        cleanText(req.body.sellerName);

    const name =
        cleanText(req.body.name);

    const description =
        cleanText(req.body.description);

    const category =
        cleanText(req.body.category) || "other";

    const image =
        cleanText(req.body.image);

    const icon =
        cleanText(req.body.icon) || "📦";

    const price =
        Number(req.body.price);

    const deliveryCharge =
        Number(req.body.deliveryCharge);

    const stock =
        req.body.stock === undefined
            ? 999999
            : Number(req.body.stock);

    if (!sellerId) {

        return res.status(400).json({
            success: false,
            message: "Seller ID প্রয়োজন।"
        });

    }

    if (!name) {

        return res.status(400).json({
            success: false,
            message: "Product Name দিন।"
        });

    }

    if (!validPrice(price)) {

        return res.status(400).json({
            success: false,
            message:
                "সঠিক Product Price দিন।"
        });

    }

    if (!validDeliveryCharge(deliveryCharge)) {

        return res.status(400).json({
            success: false,
            message:
                "সঠিক Delivery Charge দিন।"
        });

    }

    if (
        !Number.isInteger(stock) ||
        stock < 0
    ) {

        return res.status(400).json({
            success: false,
            message: "সঠিক Stock দিন।"
        });

    }

    // ========================================
    // FIND / CREATE SELLER
    // ========================================

    let seller =
        users.find(
            user =>
                user.phone === sellerId
        );

    if (!seller) {

        seller = {

            id: createId("USER"),

            name:
                sellerName || "Seller",

            phone:
                sellerId,

            role: "SELLER",

            status: "ACTIVE",

            createdAt:
                new Date().toISOString()

        };

        users.push(seller);

    } else {

        seller.role = "SELLER";

    }

    // ========================================

    const product = {

        id: createId("PRODUCT"),

        sellerId,

        sellerName:
            sellerName ||
            seller.name ||
            "Seller",

        name,

        description,

        price,

        deliveryCharge,

        category,

        image,

        icon,

        stock,

        status: "ACTIVE",

        paymentMethod:
            "CASH_ON_DELIVERY",

        createdAt:
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()

    };

    products.push(product);

    res.status(201).json({

        success: true,

        message:
            "Product সফলভাবে Add হয়েছে।",

        product

    });

});

// ============================================
// GET PRODUCTS
// ============================================

app.get("/api/products", (req, res) => {

    const activeProducts =
        products.filter(
            product =>
                product.status === "ACTIVE"
        );

    res.json({

        success: true,

        count: activeProducts.length,

        products: activeProducts

    });

});

// ============================================
// GET SINGLE PRODUCT
// ============================================

app.get("/api/products/:id", (req, res) => {

    const product =
        products.find(
            item =>
                item.id === req.params.id
        );

    if (!product) {

        return res.status(404).json({

            success: false,

            message:
                "Product পাওয়া যায়নি।"

        });

    }

    res.json({
        success: true,
        product
    });

});

// ============================================
// SELLER PRODUCTS
// ============================================

app.get(
    "/api/seller/:sellerId/products",
    (req, res) => {

        const sellerProducts =
            products.filter(
                product =>
                    product.sellerId ===
                    req.params.sellerId
            );

        res.json({

            success: true,

            count:
                sellerProducts.length,

            products:
                sellerProducts

        });

    }
);

// ============================================
// UPDATE PRODUCT
// ============================================

app.put("/api/products/:id", (req, res) => {

    const product =
        products.find(
            item =>
                item.id === req.params.id
        );

    if (!product) {

        return res.status(404).json({
            success: false,
            message:
                "Product পাওয়া যায়নি।"
        });

    }

    const {
        name,
        description,
        price,
        deliveryCharge,
        category,
        image,
        icon,
        stock,
        status
    } = req.body;

    if (name !== undefined) {

        const newName =
            cleanText(name);

        if (!newName) {

            return res.status(400).json({
                success: false,
                message:
                    "Product Name খালি রাখা যাবে না।"
            });

        }

        product.name = newName;

    }

    if (description !== undefined) {
        product.description =
            cleanText(description);
    }

    if (price !== undefined) {

        const newPrice =
            Number(price);

        if (!validPrice(newPrice)) {

            return res.status(400).json({
                success: false,
                message:
                    "সঠিক Product Price দিন।"
            });

        }

        product.price = newPrice;

    }

    if (deliveryCharge !== undefined) {

        const newCharge =
            Number(deliveryCharge);

        if (
            !validDeliveryCharge(
                newCharge
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "সঠিক Delivery Charge দিন।"
            });

        }

        product.deliveryCharge =
            newCharge;

    }

    if (category !== undefined) {
        product.category =
            cleanText(category) || "other";
    }

    if (image !== undefined) {
        product.image =
            cleanText(image);
    }

    if (icon !== undefined) {
        product.icon =
            cleanText(icon) || "📦";
    }

    if (stock !== undefined) {

        const newStock =
            Number(stock);

        if (
            !Number.isInteger(newStock) ||
            newStock < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "সঠিক Stock দিন।"
            });

        }

        product.stock = newStock;

    }

    if (status !== undefined) {

        if (
            !["ACTIVE", "INACTIVE"]
                .includes(status)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid product status."
            });

        }

        product.status = status;

    }

    product.updatedAt =
        new Date().toISOString();

    res.json({

        success: true,

        message:
            "Product successfully updated.",

        product

    });

});

// ============================================
// DELETE PRODUCT
// ============================================

app.delete("/api/products/:id", (req, res) => {

    const index =
        products.findIndex(
            product =>
                product.id === req.params.id
        );

    if (index === -1) {

        return res.status(404).json({
            success: false,
            message:
                "Product পাওয়া যায়নি।"
        });

    }

    const deletedProduct =
        products.splice(index, 1)[0];

    res.json({

        success: true,

        message:
            "Product Delete হয়েছে।",

        product:
            deletedProduct

    });

});

// ============================================
// OWNER - ALL PRODUCTS
// ============================================

app.get(
    "/api/admin/products",
    ownerAuth,
    (req, res) => {

        res.json({

            success: true,

            count:
                products.length,

            products

        });

    }
);

// ============================================
// CREATE COD ORDER
// ============================================

app.post("/api/orders", (req, res) => {

    const customerName =
        cleanText(
            req.body.customerName
        );

    const phone =
        cleanText(req.body.phone);

    const deliveryAddress =
        cleanText(
            req.body.deliveryAddress
        );

    const area =
        cleanText(req.body.area);

    const items =
        req.body.items;

    const paymentMethod =
        "CASH_ON_DELIVERY";

    if (!customerName) {

        return res.status(400).json({
            success: false,
            message:
                "Customer Name প্রয়োজন।"
        });

    }

    if (!phone) {

        return res.status(400).json({
            success: false,
            message:
                "Customer Phone প্রয়োজন।"
        });

    }

    if (!area) {

        return res.status(400).json({
            success: false,
            message:
                "Delivery Area প্রয়োজন।"
        });

    }

    if (!deliveryAddress) {

        return res.status(400).json({
            success: false,
            message:
                "Delivery Address প্রয়োজন।"
        });

    }

    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        return res.status(400).json({
            success: false,
            message:
                "Order items প্রয়োজন।"
        });

    }

    // ========================================
    // ENSURE CUSTOMER
    // ========================================

    let customer =
        users.find(
            user =>
                user.phone === phone
        );

    if (!customer) {

        customer = {

            id: createId("USER"),

            name: customerName,

            phone,

            role: "CUSTOMER",

            status: "ACTIVE",

            createdAt:
                new Date().toISOString()

        };

        users.push(customer);

    }

    // ========================================

    let productTotal = 0;

    let deliveryTotal = 0;

    const orderItems = [];

    // ========================================

    for (const item of items) {

        const productId =
            cleanText(
                item.productId ||
                item.id
            );

        const quantity =
            Number(
                item.quantity ||
                item.qty ||
                1
            );

        if (!productId) {

            return res.status(400).json({
                success: false,
                message:
                    "Product ID প্রয়োজন।"
            });

        }

        if (
            !Number.isInteger(quantity) ||
            quantity <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "সঠিক Product quantity দিন।"
            });

        }

        const product =
            products.find(
                product =>
                    product.id ===
                    productId
            );

        if (!product) {

            return res.status(400).json({
                success: false,
                message:
                    "একটি Product পাওয়া যায়নি।"
            });

        }

        if (
            product.status !==
            "ACTIVE"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    `${product.name} এখন Available নয়।`
            });

        }

        if (
            product.stock <
            quantity
        ) {

            return res.status(400).json({
                success: false,
                message:
                    `${product.name} এর পর্যাপ্ত Stock নেই।`
            });

        }

        const itemTotal =
            product.price *
            quantity;

        const sellerAlreadyAdded =
            orderItems.some(
                item =>
                    item.sellerId ===
                    product.sellerId
            );

        let sellerDelivery = 0;

        if (!sellerAlreadyAdded) {

            sellerDelivery =
                Number(
                    product.deliveryCharge
                ) || 0;

            deliveryTotal +=
                sellerDelivery;

        }

        productTotal += itemTotal;

        orderItems.push({

            productId:
                product.id,

            name:
                product.name,

            sellerId:
                product.sellerId,

            sellerName:
                product.sellerName,

            price:
                product.price,

            quantity,

            itemTotal,

            deliveryCharge:
                sellerDelivery

        });

        product.stock -= quantity;

    }

    // ========================================

    const grandTotal =
        productTotal +
        deliveryTotal;

    // ========================================

    const order = {

        id:
            createId("DB"),

        customerName,

        phone,

        area,

        deliveryAddress,

        items:
            orderItems,

        productTotal,

        deliveryTotal,

        total:
            grandTotal,

        paymentMethod,

        status:
            "ORDER_CONFIRMED",

        createdAt:
            new Date().toISOString(),

        updatedAt:
            new Date().toISOString()

    };

    orders.unshift(order);

    res.status(201).json({

        success: true,

        message:
            "Cash on Delivery Order সফলভাবে Confirm হয়েছে।",

        order

    });

});

// ============================================
// ALL ORDERS
// ============================================

app.get("/api/orders", (req, res) => {

    res.json({

        success: true,

        count:
            orders.length,

        orders

    });

});

// ============================================
// OWNER - ALL ORDERS
// ============================================

app.get(
    "/api/admin/orders",
    ownerAuth,
    (req, res) => {

        res.json({

            success: true,

            count:
                orders.length,

            orders

        });

    }
);

// ============================================
// CUSTOMER ORDERS
// ============================================

app.get(
    "/api/orders/customer/:phone",
    (req, res) => {

        const phone =
            cleanText(req.params.phone);

        const customerOrders =
            orders.filter(
                order =>
                    order.phone === phone
            );

        res.json({

            success: true,

            count:
                customerOrders.length,

            orders:
                customerOrders

        });

    }
);

// ============================================
// SINGLE ORDER
// ============================================

app.get("/api/orders/:id", (req, res) => {

    const order =
        orders.find(
            item =>
                item.id ===
                req.params.id
        );

    if (!order) {

        return res.status(404).json({
            success: false,
            message:
                "Order পাওয়া যায়নি।"
        });

    }

    res.json({
        success: true,
        order
    });

});

// ============================================
// UPDATE ORDER STATUS
// ============================================

app.put(
    "/api/orders/:id/status",
    (req, res) => {

        const order =
            orders.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!order) {

            return res.status(404).json({
                success: false,
                message:
                    "Order পাওয়া যায়নি।"
            });

        }

        const status =
            cleanText(req.body.status);

        const allowedStatuses = [

            "ORDER_CONFIRMED",
            "PROCESSING",
            "PACKED",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "CANCELLED"

        ];

        if (
            !allowedStatuses
                .includes(status)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid order status."
            });

        }

        order.status = status;

        order.updatedAt =
            new Date().toISOString();

        res.json({

            success: true,

            message:
                "Order status updated.",

            order

        });

    }
);

// ============================================
// OWNER - UPDATE ORDER STATUS
// ============================================

app.put(
    "/api/admin/orders/:id/status",
    ownerAuth,
    (req, res) => {

        const order =
            orders.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!order) {

            return res.status(404).json({
                success: false,
                message:
                    "Order পাওয়া যায়নি।"
            });

        }

        const status =
            cleanText(req.body.status);

        const allowedStatuses = [

            "ORDER_CONFIRMED",
            "PROCESSING",
            "PACKED",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "CANCELLED"

        ];

        if (
            !allowedStatuses
                .includes(status)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid order status."
            });

        }

        order.status = status;

        order.updatedAt =
            new Date().toISOString();

        res.json({

            success: true,

            message:
                "Owner successfully updated order.",

            order

        });

    }
);

// ============================================
// SELLER ORDERS
// ============================================

app.get(
    "/api/seller/:sellerId/orders",
    (req, res) => {

        const sellerId =
            cleanText(
                req.params.sellerId
            );

        const sellerOrders =
            orders.filter(
                order =>
                    order.items.some(
                        item =>
                            item.sellerId ===
                            sellerId
                    )
            );

        res.json({

            success: true,

            count:
                sellerOrders.length,

            orders:
                sellerOrders

        });

    }
);

// ============================================
// ADMIN SUMMARY
// ============================================

app.get(
    "/api/admin/summary",
    ownerAuth,
    (req, res) => {

        const totalProducts =
            products.length;

        const activeProducts =
            products.filter(
                product =>
                    product.status ===
                    "ACTIVE"
            ).length;

        const totalOrders =
            orders.length;

        const confirmedOrders =
            orders.filter(
                order =>
                    order.status ===
                    "ORDER_CONFIRMED"
            ).length;

        const processingOrders =
            orders.filter(
                order =>
                    order.status ===
                    "PROCESSING"
            ).length;

        const packedOrders =
            orders.filter(
                order =>
                    order.status ===
                    "PACKED"
            ).length;

        const deliveryOrders =
            orders.filter(
                order =>
                    order.status ===
                    "OUT_FOR_DELIVERY"
            ).length;

        const deliveredOrders =
            orders.filter(
                order =>
                    order.status ===
                    "DELIVERED"
            ).length;

        const cancelledOrders =
            orders.filter(
                order =>
                    order.status ===
                    "CANCELLED"
            ).length;

        const customers =
            users.filter(
                user =>
                    user.role ===
                    "CUSTOMER"
            ).length;

        const sellers =
            users.filter(
                user =>
                    user.role ===
                    "SELLER"
            ).length;

        let totalSales = 0;

        orders.forEach(order => {

            if (
                order.status !==
                "CANCELLED"
            ) {

                totalSales +=
                    Number(order.total) || 0;

            }

        });

        res.json({

            success: true,

            summary: {

                users:
                    users.length,

                customers,

                sellers,

                products:
                    totalProducts,

                activeProducts,

                orders:
                    totalOrders,

                confirmedOrders,

                processingOrders,

                packedOrders,

                deliveryOrders,

                deliveredOrders,

                cancelledOrders,

                totalSales

            }

        });

    }
);

// ============================================
// ADMIN USERS BLOCK / UNBLOCK
// ============================================

app.put(
    "/api/admin/users/:id/status",
    ownerAuth,
    (req, res) => {

        const user =
            users.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!user) {

            return res.status(404).json({
                success: false,
                message:
                    "User পাওয়া যায়নি।"
            });

        }

        const status =
            cleanText(req.body.status);

        if (
            !["ACTIVE", "BLOCKED"]
                .includes(status)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid user status."
            });

        }

        user.status = status;

        res.json({

            success: true,

            message:
                "User status updated.",

            user

        });

    }
);

// ============================================
// 404
// ============================================

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message:
            "API endpoint পাওয়া যায়নি।"

    });

});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {

    console.error(err);

    res.status(500).json({

        success: false,

        message:
            "Server error হয়েছে।"

    });

});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {

    console.log(
        `Dhaka Bazar Backend v4.0 running on port ${PORT}`
    );

});
