// ============================================
// DHAKA BAZAR - BACKEND API
// Version: 1.0
// ============================================

const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;

// --------------------------------------------
// MIDDLEWARE
// --------------------------------------------

app.use(cors({
    origin: "*"
}));

app.use(express.json());


// --------------------------------------------
// TEMPORARY DATABASE
// --------------------------------------------
// এখন শুধু Demo হিসেবে memory ব্যবহার করছি।
// Server restart হলে এই data মুছে যাবে।
//
// পরের ধাপে আমরা আসল database যুক্ত করব।

const users = [];

const transactions = [];


// --------------------------------------------
// HOME / HEALTH CHECK
// --------------------------------------------

app.get("/", (req, res) => {

    res.json({
        success: true,
        app: "Dhaka Bazar",
        message: "Dhaka Bazar Backend is running!",
        version: "1.0"
    });

});


// --------------------------------------------
// SERVER STATUS
// --------------------------------------------

app.get("/api/status", (req, res) => {

    res.json({
        success: true,
        status: "online",
        serverTime: new Date().toISOString()
    });

});


// --------------------------------------------
// CREATE USER
// --------------------------------------------

app.post("/api/users", (req, res) => {

    const {
        name,
        phone
    } = req.body;

    if (!name || !phone) {

        return res.status(400).json({
            success: false,
            message: "নাম এবং মোবাইল নম্বর প্রয়োজন।"
        });

    }

    const existingUser =
        users.find(user => user.phone === phone);

    if (existingUser) {

        return res.json({
            success: true,
            message: "User already exists.",
            user: existingUser
        });

    }

    const user = {

        id:
            "USER-" +
            Date.now(),

        name: name,

        phone: phone,

        walletBalance: 0,

        createdAt:
            new Date().toISOString()

    };

    users.push(user);

    res.status(201).json({

        success: true,

        message: "Account created successfully.",

        user: user

    });

});


// --------------------------------------------
// GET USER
// --------------------------------------------

app.get("/api/users/:phone", (req, res) => {

    const phone =
        req.params.phone;

    const user =
        users.find(
            user => user.phone === phone
        );

    if (!user) {

        return res.status(404).json({

            success: false,

            message: "User পাওয়া যায়নি।"

        });

    }

    res.json({

        success: true,

        user: user

    });

});


// --------------------------------------------
// WALLET BALANCE
// --------------------------------------------

app.get("/api/wallet/:phone", (req, res) => {

    const phone =
        req.params.phone;

    const user =
        users.find(
            user => user.phone === phone
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


// --------------------------------------------
// DEMO WALLET CREDIT
// --------------------------------------------
// ⚠️ এটি শুধুমাত্র development/demo-এর জন্য।
// এখানে বাস্তব টাকা যোগ করা যাবে না।
//
// আসল Wallet top-up পরে payment gateway
// verification-এর মাধ্যমে হবে।

app.post("/api/wallet/demo-credit", (req, res) => {

    const {
        phone,
        amount
    } = req.body;

    if (!phone || !amount) {

        return res.status(400).json({

            success: false,

            message:
                "Phone এবং amount প্রয়োজন।"

        });

    }

    const numericAmount =
        Number(amount);

    if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "সঠিক amount দিন।"

        });

    }

    const user =
        users.find(
            user => user.phone === phone
        );

    if (!user) {

        return res.status(404).json({

            success: false,

            message:
                "User পাওয়া যায়নি।"

        });

    }

    user.walletBalance +=
        numericAmount;

    const transaction = {

        id:
            "TXN-" +
            Date.now(),

        userId:
            user.id,

        type:
            "DEMO_CREDIT",

        amount:
            numericAmount,

        status:
            "SUCCESS",

        createdAt:
            new Date().toISOString()

    };

    transactions.push(transaction);

    res.json({

        success: true,

        message:
            "Demo wallet credit successful.",

        balance:
            user.walletBalance,

        transaction:
            transaction

    });

});


// --------------------------------------------
// TRANSACTION HISTORY
// --------------------------------------------

app.get(
    "/api/transactions/:phone",
    (req, res) => {

        const phone =
            req.params.phone;

        const user =
            users.find(
                user => user.phone === phone
            );

        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User পাওয়া যায়নি।"

            });

        }

        const userTransactions =
            transactions.filter(
                transaction =>
                    transaction.userId === user.id
            );

        res.json({

            success: true,

            transactions:
                userTransactions

        });

    }
);


// --------------------------------------------
// 5% COMMISSION CALCULATOR
// --------------------------------------------
// ⚠️ এখন শুধু হিসাব দেখানোর জন্য।
//
// আসল টাকা automatically bKash/Nagad-এ
// পাঠানোর কাজ এখানে করা হচ্ছে না।
// সেটা approved merchant/payment API দিয়ে
// server-side verification-এর পরে করতে হবে।

app.post("/api/commission/calculate", (req, res) => {

    const {
        amount
    } = req.body;

    const numericAmount =
        Number(amount);

    if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
    ) {

        return res.status(400).json({

            success: false,

            message:
                "সঠিক amount দিন।"

        });

    }

    const commission =
        numericAmount * 0.05;

    const remaining =
        numericAmount - commission;

    res.json({

        success: true,

        amount:
            numericAmount,

        commissionRate:
            "5%",

        commission:
            Number(
                commission.toFixed(2)
            ),

        remaining:
            Number(
                remaining.toFixed(2)
            )

    });

});


// --------------------------------------------
// 404 HANDLER
// --------------------------------------------

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message:
            "API endpoint পাওয়া যায়নি।"

    });

});


// --------------------------------------------
// ERROR HANDLER
// --------------------------------------------

app.use((err, req, res, next) => {

    console.error(err);

    res.status(500).json({

        success: false,

        message:
            "Server error হয়েছে।"

    });

});


// --------------------------------------------
// START SERVER
// --------------------------------------------

app.listen(PORT, () => {

    console.log(
        `Dhaka Bazar Backend running on port ${PORT}`
    );

});
