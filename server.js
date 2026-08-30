// ============================================
// DHAKA BAZAR - BACKEND API
// Version: 2.0
// ============================================

const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
    origin: "*"
}));

app.use(express.json());

// ============================================
// TEMPORARY DATABASE
// ⚠️ Demo purpose only
// Server restart হলে data মুছে যাবে
// ============================================

const users = [];
const products = [];
const orders = [];
const transactions = [];

// ============================================
// HOME
// ============================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        app: "Dhaka Bazar",
        message: "Dhaka Bazar Backend is running!",
        version: "2.0"
    });

});

// ============================================
// SERVER STATUS
// ============================================

app.get("/api/status", (req, res) => {

    res.json({
        success: true,
        status: "online",
        serverTime: new Date().toISOString()
    });

});

// ============================================
// USER CREATE / LOGIN
// ============================================

app.post("/api/users", (req, res) => {

    const { name, phone } = req.body;

    if (!name || !phone) {

        return res.status(400).json({
            success: false,
            message: "নাম এবং মোবাইল নম্বর প্রয়োজন।"
        });

    }

    let user = users.find(
        user => user.phone === phone
    );

    if (user) {

        return res.json({
            success: true,
            message: "User already exists.",
            user
        });

    }

    user = {

        id: "USER-" + Date.now(),

        name,

        phone,

        walletBalance: 0,

        createdAt: new Date().toISOString()

    };

    users.push(user);

    res.status(201).json({

        success: true,

        message: "Account created successfully.",

        user

    });

});

// ============================================
// GET USER
// ============================================

app.get("/api/users/:phone", (req, res) => {

    const user = users.find(
        user => user.phone === req.params.phone
    );

    if (!user) {

        return res.status(404).json({
            success: false,
            message: "User পাওয়া যায়নি।"
        });

    }

    res.json({
        success: true,
        user
    });

});

// ============================================
// ADD PRODUCT
// ============================================

app.post("/api/products", (req, res) => {

    const {
        sellerId,
        name,
        description,
        price,
        category,
        image,
        stock
    } = req.body;

    if (
        !sellerId ||
        !name ||
        price === undefined
    ) {

        return res.status(400).json({
            success: false,
            message:
                "sellerId, name এবং price প্রয়োজন।"
        });

    }

    const numericPrice = Number(price);
    const numericStock = Number(stock || 0);

    if (
        !Number.isFinite(numericPrice) ||
        numericPrice <= 0
    ) {

        return res.status(400).json({
            success: false,
            message: "সঠিক product price দিন।"
        });

    }

    const product = {

        id: "PRODUCT-" + Date.now(),

        sellerId,

        name,

        description: description || "",

        price: numericPrice,

        category: category || "other",

        image: image || "",

        stock:
            Number.isFinite(numericStock)
                ? numericStock
                : 0,

        status: "ACTIVE",

        createdAt:
            new Date().toISOString()

    };

    products.push(product);

    res.status(201).json({

        success: true,

        message: "Product added successfully.",

        product

    });

});

// ============================================
// GET ALL PRODUCTS
// ============================================

app.get("/api/products", (req, res) => {

    res.json({

        success: true,

        count: products.length,

        products

    });

});

// ============================================
// GET SINGLE PRODUCT
// ============================================

app.get("/api/products/:id", (req, res) => {

    const product = products.find(
        product => product.id === req.params.id
    );

    if (!product) {

        return res.status(404).json({

            success: false,

            message: "Product পাওয়া যায়নি।"

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

            products: sellerProducts

        });

    }
);

// ============================================
// UPDATE PRODUCT
// ============================================

app.put("/api/products/:id", (req, res) => {

    const product = products.find(
        product => product.id === req.params.id
    );

    if (!product) {

        return res.status(404).json({

            success: false,

            message: "Product পাওয়া যায়নি।"

        });

    }

    const {
        name,
        description,
        price,
        category,
        image,
        stock,
        status
    } = req.body;

    if (name !== undefined)
        product.name = name;

    if (description !== undefined)
        product.description = description;

    if (price !== undefined) {

        const numericPrice = Number(price);

        if (
            !Number.isFinite(numericPrice) ||
            numericPrice <= 0
        ) {

            return res.status(400).json({

                success: false,

                message: "সঠিক price দিন।"

            });

        }

        product.price = numericPrice;

    }

    if (category !== undefined)
        product.category = category;

    if (image !== undefined)
        product.image = image;

    if (stock !== undefined)
        product.stock = Number(stock);

    if (status !== undefined)
        product.status = status;

    product.updatedAt =
        new Date().toISOString();

    res.json({

        success: true,

        message: "Product updated successfully.",

        product

    });

});

// ============================================
// DELETE PRODUCT
// ============================================

app.delete("/api/products/:id", (req, res) => {

    const index = products.findIndex(
        product => product.id === req.params.id
    );

    if (index === -1) {

        return res.status(404).json({

            success: false,

            message: "Product পাওয়া যায়নি।"

        });

    }

    const deletedProduct =
        products.splice(index, 1)[0];

    res.json({

        success: true,

        message: "Product deleted successfully.",

        product: deletedProduct

    });

});

// ============================================
// WALLET
// ============================================

app.get("/api/wallet/:phone", (req, res) => {

    const user = users.find(
        user => user.phone === req.params.phone
    );

    if (!user) {

        return res.status(404).json({

            success: false,

            message: "User পাওয়া যায়নি।"

        });

    }

    res.json({

        success: true,

        wallet: {

            userId: user.id,

            balance: user.walletBalance

        }

    });

});

// ============================================
// DEMO WALLET CREDIT
// ⚠️ REAL MONEY নয়
// ============================================

app.post("/api/wallet/demo-credit", (req, res) => {

    const {
        phone,
        amount
    } = req.body;

    const numericAmount = Number(amount);

    if (!phone || !Number.isFinite(numericAmount)) {

        return res.status(400).json({

            success: false,

            message: "Phone এবং সঠিক amount প্রয়োজন।"

        });

    }

    if (numericAmount <= 0) {

        return res.status(400).json({

            success: false,

            message: "Amount 0-এর বেশি হতে হবে।"

        });

    }

    const user = users.find(
        user => user.phone === phone
    );

    if (!user) {

        return res.status(404).json({

            success: false,

            message: "User পাওয়া যায়নি।"

        });

    }

    user.walletBalance += numericAmount;

    const transaction = {

        id: "TXN-" + Date.now(),

        userId: user.id,

        type: "DEMO_CREDIT",

        amount: numericAmount,

        status: "SUCCESS",

        createdAt:
            new Date().toISOString()

    };

    transactions.push(transaction);

    res.json({

        success: true,

        message: "Demo wallet credit successful.",

        balance: user.walletBalance,

        transaction

    });

});

// ============================================
// CHECKOUT
// ============================================

app.post("/api/orders", (req, res) => {

    const {
        phone,
        items,
        deliveryAddress,
        paymentMethod
    } = req.body;

    if (!phone) {

        return res.status(400).json({

            success: false,

            message: "Customer phone প্রয়োজন।"

        });

    }

    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        return res.status(400).json({

            success: false,

            message: "Order items প্রয়োজন।"

        });

    }

    if (!deliveryAddress) {

        return res.status(400).json({

            success: false,

            message: "Delivery address প্রয়োজন।"

        });

    }

    const user = users.find(
        user => user.phone === phone
    );

    if (!user) {

        return res.status(404).json({

            success: false,

            message: "Customer account পাওয়া যায়নি।"

        });

    }

    let total = 0;

    const orderItems = [];

    for (const item of items) {

        const product = products.find(
            product => product.id === item.productId
        );

        if (!product) {

            return res.status(400).json({

                success: false,

                message:
                    "একটি product পাওয়া যায়নি।"

            });

        }

        const quantity =
            Number(item.quantity || 1);

        if (
            !Number.isInteger(quantity) ||
            quantity <= 0
        ) {

            return res.status(400).json({

                success: false,

                message: "সঠিক quantity দিন।"

            });

        }

        if (product.stock < quantity) {

            return res.status(400).json({

                success: false,

                message:
                    `${product.name} এর পর্যাপ্ত stock নেই।`

            });

        }

        const itemTotal =
            product.price * quantity;

        total += itemTotal;

        orderItems.push
