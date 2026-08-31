// ======================================================
// DHAKA BAZAR - COMPLETE COD BACKEND
// OTP SMS + REGISTRATION + LOGIN + PRODUCTS + ORDERS
// ======================================================

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

// ======================================================
// TWILIO CONFIG
// ======================================================

const TWILIO_ACCOUNT_SID =
    process.env.TWILIO_ACCOUNT_SID || "";

const TWILIO_AUTH_TOKEN =
    process.env.TWILIO_AUTH_TOKEN || "";

const TWILIO_VERIFY_SERVICE_SID =
    process.env.TWILIO_VERIFY_SERVICE_SID || "";


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors({
    origin: "*"
}));

app.use(express.json({
    limit: "10mb"
}));


// ======================================================
// DATABASE
// DEMO IN-MEMORY DATABASE
// ======================================================

const users = [];
const products = [];
const orders = [];


// ======================================================
// OTP / SESSION STORAGE
// ======================================================

const otpRequests = new Map();
const sessions = new Map();


// ======================================================
// HELPER FUNCTIONS
// ======================================================

function createId(prefix) {

    return prefix +
        "-" +
        Date.now() +
        "-" +
        crypto.randomBytes(4).toString("hex");

}


function cleanText(value) {

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value).trim();

}


function numberValue(value) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : NaN;

}


function normalizePhone(phone) {

    let value =
        cleanText(phone)
            .replace(/\s+/g, "")
            .replace(/-/g, "");

    /*
     * Bangladesh number:
     * 019XXXXXXXX
     *
     * Convert to:
     * +88019XXXXXXXX
     */

    if (
        /^01[3-9]\d{8}$/.test(value)
    ) {

        value =
            "+88" + value;

    }

    /*
     * If user gives 8801XXXXXXXXX
     */

    if (
        /^8801[3-9]\d{8}$/.test(value)
    ) {

        value =
            "+" + value;

    }

    return value;

}


function isValidPhone(phone) {

    return /^\+[1-9]\d{7,14}$/.test(phone);

}


function hashPassword(password) {

    const salt =
        crypto.randomBytes(16).toString("hex");

    const hash =
        crypto.scryptSync(
            password,
            salt,
            64
        ).toString("hex");

    return {
        salt,
        hash
    };

}


function verifyPassword(
    password,
    salt,
    storedHash
) {

    const hash =
        crypto.scryptSync(
            password,
            salt,
            64
        ).toString("hex");

    return crypto.timingSafeEqual(
        Buffer.from(hash, "hex"),
        Buffer.from(storedHash, "hex")
    );

}


function createToken() {

    return crypto
        .randomBytes(32)
        .toString("hex");

}


// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {

    res.json({

        success: true,

        app: "Dhaka Bazar",

        message:
            "Dhaka Bazar COD Backend is running!",

        version: "4.0",

        paymentMethod:
            "CASH_ON_DELIVERY"

    });

});


// ======================================================
// STATUS
// ======================================================

app.get("/api/status", (req, res) => {

    res.json({

        success: true,

        status: "online",

        otp:
            TWILIO_VERIFY_SERVICE_SID
                ? "configured"
                : "not_configured",

        paymentMethod:
            "CASH_ON_DELIVERY",

        serverTime:
            new Date().toISOString()

    });

});


// ======================================================
// AUTH - REQUEST OTP
// POST /api/auth/request-otp
// ======================================================

app.post(
    "/api/auth/request-otp",
    async (req, res) => {

        try {

            const phone =
                normalizePhone(req.body.phone);

            if (!phone) {

                return res.status(400).json({

                    success: false,

                    message:
                        "মোবাইল নম্বর দিন।"

                });

            }

            if (!isValidPhone(phone)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "সঠিক আন্তর্জাতিক মোবাইল নম্বর দিন। উদাহরণ: +8801954799646"

                });

            }

            if (
                !TWILIO_ACCOUNT_SID ||
                !TWILIO_AUTH_TOKEN ||
                !TWILIO_VERIFY_SERVICE_SID
            ) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Twilio Environment Variables সেট করা হয়নি।"

                });

            }


            /*
             * Prevent repeated requests
             */

            const previous =
                otpRequests.get(phone);

            if (previous) {

                const seconds =
                    Math.floor(
                        (Date.now() -
                            previous.requestedAt) /
                        1000
                    );

                if (seconds < 60) {

                    return res.status(429).json({

                        success: false,

                        message:
                            `অনুগ্রহ করে ${60 - seconds} সেকেন্ড পরে আবার চেষ্টা করুন।`

                    });

                }

            }


            /*
             * Twilio Verify API
             */

            const url =
                `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`;


            const body =
                new URLSearchParams({

                    To: phone,

                    Channel: "sms"

                });


            const auth =
                Buffer
                    .from(
                        TWILIO_ACCOUNT_SID +
                        ":" +
                        TWILIO_AUTH_TOKEN
                    )
                    .toString("base64");


            const response =
                await fetch(url, {

                    method: "POST",

                    headers: {

                        "Authorization":
                            `Basic ${auth}`,

                        "Content-Type":
                            "application/x-www-form-urlencoded"

                    },

                    body

                });


            const data =
                await response.json();


            if (!response.ok) {

                console.error(
                    "Twilio error:",
                    data
                );

                return res.status(400).json({

                    success: false,

                    message:
                        data.message ||
                        "OTP পাঠানো যায়নি।"

                });

            }


            otpRequests.set(
                phone,
                {

                    requestedAt:
                        Date.now(),

                    status:
                        data.status || "pending"

                }
            );


            return res.json({

                success: true,

                message:
                    "আপনার মোবাইলে OTP পাঠানো হয়েছে।",

                phone,

                status:
                    data.status || "pending"

            });

        }

        catch (error) {

            console.error(
                "REQUEST OTP ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "OTP পাঠাতে Server Error হয়েছে।"

            });

        }

    }
);


// ======================================================
// AUTH - VERIFY OTP
// POST /api/auth/verify-otp
// ======================================================

app.post(
    "/api/auth/verify-otp",
    async (req, res) => {

        try {

            const phone =
                normalizePhone(req.body.phone);

            const otp =
                cleanText(req.body.otp);

            const name =
                cleanText(req.body.name);

            const password =
                cleanText(req.body.password);


            if (!phone) {

                return res.status(400).json({

                    success: false,

                    message:
                        "মোবাইল নম্বর দিন।"

                });

            }


            if (!otp) {

                return res.status(400).json({

                    success: false,

                    message:
                        "OTP দিন।"

                });

            }


            if (
                otp.length < 4 ||
                otp.length > 8
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "সঠিক OTP দিন।"

                });

            }


            if (
                !TWILIO_ACCOUNT_SID ||
                !TWILIO_AUTH_TOKEN ||
                !TWILIO_VERIFY_SERVICE_SID
            ) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Twilio Environment Variables সেট করা হয়নি।"

                });

            }


            /*
             * Check OTP with Twilio
             */

            const url =
                `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;


            const body =
                new URLSearchParams({

                    To: phone,

                    Code: otp

                });


            const auth =
                Buffer
                    .from(
                        TWILIO_ACCOUNT_SID +
                        ":" +
                        TWILIO_AUTH_TOKEN
                    )
                    .toString("base64");


            const response =
                await fetch(url, {

                    method: "POST",

                    headers: {

                        "Authorization":
                            `Basic ${auth}`,

                        "Content-Type":
                            "application/x-www-form-urlencoded"

                    },

                    body

                });


            const data =
                await response.json();


            if (!response.ok) {

                return res.status(400).json({

                    success: false,

                    message:
                        data.message ||
                        "OTP verification failed।"

                });

            }


            if (data.status !== "approved") {

                return res.status(400).json({

                    success: false,

                    message:
                        "OTP সঠিক নয়।"

                });

            }


            /*
             * Registration
             */

            let user =
                users.find(
                    item =>
                        item.phone === phone
                );


            if (!user) {

                if (!name) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Registration-এর জন্য নাম দিন।"

                    });

                }


                if (
                    password.length < 6
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Password কমপক্ষে ৬ অক্ষরের হতে হবে।"

                    });

                }


                const passwordData =
                    hashPassword(password);


                user = {

                    id:
                        createId("USER"),

                    name,

                    phone,

                    passwordHash:
                        passwordData.hash,

                    passwordSalt:
                        passwordData.salt,

                    role:
                        "CUSTOMER",

                    createdAt:
                        new Date().toISOString()

                };


                users.push(user);

            }


            /*
             * Create Login Session
             */

            const token =
                createToken();


            sessions.set(
                token,
                {

                    userId:
                        user.id,

                    phone:
                        user.phone,

                    createdAt:
                        Date.now()

                }
            );


            otpRequests.delete(phone);


            return res.json({

                success: true,

                message:
                    "OTP verification সফল হয়েছে। Account প্রস্তুত।",

                token,

                user: {

                    id:
                        user.id,

                    name:
                        user.name,

                    phone:
                        user.phone,

                    role:
                        user.role

                }

            });

        }

        catch (error) {

            console.error(
                "VERIFY OTP ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "OTP verification-এ Server Error হয়েছে।"

            });

        }

    }
);


// ======================================================
// AUTH - LOGIN
// POST /api/auth/login
// ======================================================

app.post(
    "/api/auth/login",
    (req, res) => {

        try {

            const phone =
                normalizePhone(req.body.phone);

            const password =
                cleanText(req.body.password);


            if (!phone || !password) {

                return res.status(400).json({

                    success: false,

                    message:
                        "মোবাইল নম্বর এবং Password দিন।"

                });

            }


            const user =
                users.find(
                    item =>
                        item.phone === phone
                );


            if (!user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Account পাওয়া যায়নি। আগে Registration করুন।"

                });

            }


            if (
                !user.passwordHash ||
                !user.passwordSalt
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "এই Account-এর Password সেট করা নেই।"

                });

            }


            const correct =
                verifyPassword(
                    password,
                    user.passwordSalt,
                    user.passwordHash
                );


            if (!correct) {

                return res.status(401).json({

                    success: false,

                    message:
                        "মোবাইল নম্বর অথবা Password ভুল।"

                });

            }


            const token =
                createToken();


            sessions.set(
                token,
                {

                    userId:
                        user.id,

                    phone:
                        user.phone,

                    createdAt:
                        Date.now()

                }
            );


            return res.json({

                success: true,

                message:
                    "Login সফল হয়েছে।",

                token,

                user: {

                    id:
                        user.id,

                    name:
                        user.name,

                    phone:
                        user.phone,

                    role:
                        user.role

                }

            });

        }

        catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Login Server Error হয়েছে।"

            });

        }

    }
);


// ======================================================
// AUTH - ME
// ======================================================

app.get(
    "/api/auth/me",
    (req, res) => {

        const auth =
            req.headers.authorization || "";

        const token =
            auth.startsWith("Bearer ")
                ? auth.substring(7)
                : "";


        if (!token) {

            return res.status(401).json({

                success: false,

                message:
                    "Login token প্রয়োজন।"

            });

        }


        const session =
            sessions.get(token);


        if (!session) {

            return res.status(401).json({

                success: false,

                message:
                    "Session expired বা invalid।"

            });

        }


        const user =
            users.find(
                item =>
                    item.id ===
                    session.userId
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

            user: {

                id:
                    user.id,

                name:
                    user.name,

                phone:
                    user.phone,

                role:
                    user.role

            }

        });

    }
);


// ======================================================
// LOGOUT
// ======================================================

app.post(
    "/api/auth/logout",
    (req, res) => {

        const auth =
            req.headers.authorization || "";

        const token =
            auth.startsWith("Bearer ")
                ? auth.substring(7)
                : "";

        if (token) {

            sessions.delete(token);

        }

        res.json({

            success: true,

            message:
                "Logout সফল হয়েছে।"

        });

    }
);


// ======================================================
// CREATE / UPDATE USER
// ======================================================

app.post(
    "/api/users",
    (req, res) => {

        const name =
            cleanText(req.body.name);

        const phone =
            normalizePhone(req.body.phone);


        if (!name || !phone) {

            return res.status(400).json({

                success: false,

                message:
                    "নাম এবং মোবাইল নম্বর প্রয়োজন।"

            });

        }


        let user =
            users.find(
                item =>
                    item.phone === phone
            );


        if (user) {

            user.name = name;


            return res.json({

                success: true,

                message:
                    "Account পাওয়া গেছে।",

                user: {

                    id:
                        user.id,

                    name:
                        user.name,

                    phone:
                        user.phone,

                    role:
                        user.role

                }

            });

        }


        user = {

            id:
                createId("USER"),

            name,

            phone,

            role:
                "CUSTOMER",

            createdAt:
                new Date().toISOString()

        };


        users.push(user);


        res.status(201).json({

            success: true,

            message:
                "Account তৈরি হয়েছে।",

            user

        });

    }
);


// ======================================================
// GET USER
// ======================================================

app.get(
    "/api/users/:phone",
    (req, res) => {

        const phone =
            normalizePhone(
                req.params.phone
            );


        const user =
            users.find(
                item =>
                    item.phone === phone
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

            user: {

                id:
                    user.id,

                name:
                    user.name,

                phone:
                    user.phone,

                role:
                    user.role

            }

        });

    }
);


// ======================================================
// UPDATE USER
// ======================================================

app.put(
    "/api/users/:phone",
    (req, res) => {

        const phone =
            normalizePhone(
                req.params.phone
            );


        const user =
            users.find(
                item =>
                    item.phone === phone
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User পাওয়া যায়নি।"

            });

        }


        const name =
            cleanText(req.body.name);


        if (name) {

            user.name = name;

        }


        user.updatedAt =
            new Date().toISOString();


        res.json({

            success: true,

            message:
                "Account update হয়েছে।",

            user: {

                id:
                    user.id,

                name:
                    user.name,

                phone:
                    user.phone,

                role:
                    user.role

            }

        });

    }
);


// ======================================================
// ADD PRODUCT
// POST /api/products
// ======================================================

app.post(
    "/api/products",
    (req, res) => {

        const sellerId =
            cleanText(req.body.sellerId);

        const name =
            cleanText(req.body.name);

        const description =
            cleanText(req.body.description);

        const category =
            cleanText(req.body.category) ||
            "other";

        /*
         * Gallery image / Base64 / URL
         */

        const image =
            cleanText(req.body.image);

        const price =
            numberValue(req.body.price);

        const stock =
            numberValue(
                req.body.stock === undefined
                    ? 0
                    : req.body.stock
            );

        const deliveryCharge =
            numberValue(
                req.body.deliveryCharge === undefined
                    ? 0
                    : req.body.deliveryCharge
            );


        if (!sellerId) {

            return res.status(400).json({

                success: false,

                message:
                    "Seller ID প্রয়োজন।"

            });

        }


        if (!name) {

            return res.status(400).json({

                success: false,

                message:
                    "Product Name প্রয়োজন।"

            });

        }


        if (
            !Number.isFinite(price) ||
            price <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "সঠিক Product Price দিন।"

            });

        }


        if (
            !Number.isFinite(stock) ||
            stock < 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "সঠিক Stock দিন।"

            });

        }


        if (
            !Number.isFinite(deliveryCharge) ||
            deliveryCharge < 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "সঠিক Delivery Charge দিন।"

            });

        }


        const product = {

            id:
                createId("PRODUCT"),

            sellerId,

            name,

            description,

            category,

            /*
             * Product original image
             */

            image,

            price,

            stock,

            deliveryCharge,

            paymentMethod:
                "CASH_ON_DELIVERY",

            status:
                "ACTIVE",

            createdAt:
                new Date().toISOString()

        };


        products.push(product);


        res.status(201).json({

            success: true,

            message:
                "Product সফলভাবে Add হয়েছে।",

            product

        });

    }
);


// ======================================================
// GET ALL PRODUCTS
// ======================================================

app.get(
    "/api/products",
    (req, res) => {

        const category =
            cleanText(
                req.query.category
            );

        const search =
            cleanText(
                req.query.search
            ).toLowerCase();


        let result =
            products.filter(
                product =>
                    product.status ===
                    "ACTIVE"
            );


        if (category) {

            result =
                result.filter(
                    product =>
                        product.category ===
                        category
                );

        }


        if (search) {

            result =
                result.filter(
                    product =>

                        product.name
                            .toLowerCase()
                            .includes(search)

                        ||

                        product.description
                            .toLowerCase()
                            .includes(search)

                        ||

                        product.category
                            .toLowerCase()
                            .includes(search)

                );

        }


        res.json({

            success: true,

            count:
                result.length,

            products:
                result

        });

    }
);


// ======================================================
// GET SINGLE PRODUCT
// ======================================================

app.get(
    "/api/products/:id",
    (req, res) => {

        const product =
            products.find(
                item =>
                    item.id ===
                    req.params.id
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

    }
);


// ======================================================
// SELLER PRODUCTS
// ======================================================

app.get(
    "/api/seller/:sellerId/products",
    (req, res) => {

        const sellerId =
            cleanText(
                req.params.sellerId
            );


        const sellerProducts =
            products.filter(
                product =>
                    product.sellerId ===
                    sellerId
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


// ======================================================
// UPDATE PRODUCT
// ======================================================

app.put(
    "/api/products/:id",
    (req, res) => {

        const product =
            products.find(
                item =>
                    item.id ===
                    req.params.id
            );


        if (!product) {

            return res.status(404).json({

                success: false,

                message:
                    "Product পাওয়া যায়নি।"

            });

        }


        if (
            req.body.name !==
            undefined
        ) {

            const name =
                cleanText(
                    req.body.name
                );


            if (!name) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Product Name খালি রাখা যাবে না।"

                });

            }


            product.name = name;

        }


        if (
            req.body.description !==
            undefined
        ) {

            product.description =
                cleanText(
                    req.body.description
                );

        }


        if (
            req.body.category !==
            undefined
        ) {

            product.category =
                cleanText(
                    req.body.category
                ) || "other";

        }


        if (
            req.body.image !==
            undefined
        ) {

            product.image =
                cleanText(
                    req.body.image
                );

        }


        if (
            req.body.price !==
            undefined
        ) {

            const price =
                numberValue(
                    req.body.price
                );


            if (
                !Number.isFinite(price) ||
                price <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "সঠিক Product Price দিন।"

                });

            }


            product.price = price;

        }


        if (
            req.body.stock !==
            undefined
        ) {

            const stock =
                numberValue(
                    req.body.stock
                );


            if (
                !Number.isFinite(stock) ||
                stock < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "সঠিক Stock দিন।"

                });

            }


            product.stock = stock;

        }


        if (
            req.body.deliveryCharge !==
            undefined
        ) {

            const charge =
                numberValue(
                    req.body.deliveryCharge
                );


            if (
                !Number.isFinite(charge) ||
                charge < 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "সঠিক Delivery Charge দিন।"

                });

            }


            product.deliveryCharge =
                charge;

        }


        if (
            req.body.status !==
            undefined
        ) {

            const status =
                cleanText(
                    req.body.status
                );


            if (
                status === "ACTIVE" ||
                status === "INACTIVE"
            ) {

                product.status =
                    status;

            }

        }


        product.updatedAt =
            new Date().toISOString();


        res.json({

            success: true,

            message:
                "Product Update হয়েছে।",

            product

        });

    }
);


// ======================================================
// DELETE PRODUCT
// ======================================================

app.delete(
    "/api/products/:id",
    (req, res) => {

        const index =
            products.findIndex(
                product =>
                    product.id ===
                    req.params.id
            );


        if (index === -1) {

            return res.status(404).json({

                success: false,

                message:
                    "Product পাওয়া যায়নি।"

            });

        }


        const deletedProduct =
            products.splice(
                index,
                1
            )[0];


        res.json({

            success: true,

            message:
                "Product Delete হয়েছে।",

            product:
                deletedProduct

        });

    }
);


// ======================================================
// CATEGORIES
// ======================================================

app.get(
    "/api/categories",
    (req, res) => {

        res.json({

            success: true,

            categories: [

                {
                    id: "grocery",
                    name: "মুদিখানা"
                },

                {
                    id: "food",
                    name: "খাবার"
                },

                {
                    id: "fashion",
                    name: "ফ্যাশন"
                },

                {
                    id: "electronics",
                    name: "ইলেকট্রনিক্স"
                },

                {
                    id: "home",
                    name: "হোম"
                },

                {
                    id: "beauty",
                    name: "বিউটি"
                },

                {
                    id: "baby",
                    name: "বেবি"
                },

                {
                    id: "medicine",
                    name: "স্বাস্থ্য ও ফার্মেসি"
                },

                {
                    id: "stationery",
                    name: "স্টেশনারি"
                },

                {
                    id: "sports",
                    name: "স্পোর্টস"
                },

                {
                    id: "automobile",
                    name: "অটোমোবাইল"
                },

                {
                    id: "other",
                    name: "অন্যান্য"
                }

            ]

        });

    }
);


// ======================================================
// CREATE COD ORDER
// ======================================================

app.post(
    "/api/orders",
    (req, res) => {

        const phone =
            normalizePhone(
                req.body.phone
            );

        const deliveryAddress =
            cleanText(
                req.body.deliveryAddress
            );

        const items =
            Array.isArray(req.body.items)
                ? req.body.items
                : [];


        const paymentMethod =
            "CASH_ON_DELIVERY";


        if (!phone) {

            return res.status(400).json({

                success: false,

                message:
                    "Customer phone প্রয়োজন।"

            });

        }


        if (items.length === 0) {

            return res.status(400).json({

                success: false,

                message:
                    "কমপক্ষে একটি Product প্রয়োজন।"

            });

        }


        if (!deliveryAddress) {

            return res.status(400).json({

                success: false,

                message:
                    "Delivery Address প্রয়োজন।"

            });

        }


        const user =
            users.find(
                item =>
                    item.phone === phone
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "Customer Account পাওয়া যায়নি।"

            });

        }


        let productTotal = 0;

        let deliveryTotal = 0;

        const orderItems = [];


        for (
            const item of items
        ) {

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
                        "সঠিক Quantity দিন।"

                });

            }


            const product =
                products.find(
                    p =>
                        p.id ===
                        productId
                );


            if (!product) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Product পাওয়া যায়নি।"

                });

            }


            if (
                product.status !==
                "ACTIVE"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `${product.name} বর্তমানে Available নয়।`

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


            const alreadyAddedSeller =
                orderItems.some(
                    orderItem =>
                        orderItem.sellerId ===
                        product.sellerId
                );


            if (
                !alreadyAddedSeller
            ) {

                deliveryTotal +=
                    Number(
                        product.deliveryCharge ||
                        0
                    );

            }


            productTotal +=
                itemTotal;


            orderItems.push({

                productId:
                    product.id,

                sellerId:
                    product.sellerId,

                productName:
                    product.name,

                image:
                    product.image,

                price:
                    product.price,

                quantity,

                itemTotal,

                deliveryCharge:
                    Number(
                        product.deliveryCharge ||
                        0
                    )

            });

        }


        const grandTotal =
            productTotal +
            deliveryTotal;


        /*
         * Reduce stock
         */

        for (
            const item of orderItems
        ) {

            const product =
                products.find(
                    p =>
                        p.id ===
                        item.productId
                );


            if (product) {

                product.stock -=
                    item.quantity;

            }

        }


        const order = {

            id:
                createId("DB"),

            customerId:
                user.id,

            customerName:
                user.name,

            phone,

            deliveryAddress,

            items:
                orderItems,

            productTotal,

            deliveryCharge:
                deliveryTotal,

            grandTotal,

            total:
                grandTotal,

            paymentMethod:
                paymentMethod,

            paymentStatus:
                "PAY_ON_DELIVERY",

            orderStatus:
                "ORDER_CONFIRMED",

            createdAt:
                new Date().toISOString()

        };


        orders.unshift(order);


        res.status(201).json({

            success: true,

            message:
                "Cash on Delivery Order সফলভাবে Confirm হয়েছে।",

            order

        });

    }
);


// ======================================================
// CUSTOMER ORDERS
// ======================================================

app.get(
    "/api/orders/customer/:phone",
    (req, res) => {

        const phone =
            normalizePhone(
                req.params.phone
            );


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


// ======================================================
// SINGLE ORDER
// ======================================================

app.get(
    "/api/orders/:id",
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


        res.json({

            success: true,

            order

        });

    }
);


// ======================================================
// SELLER ORDERS
// ======================================================

app.get(
    "/api/seller/:sellerId/orders",
    (req, res) => {

        const sellerId =
            cleanText(
                req.params.sellerId
            );


        const sellerOrders =
            orders
                .map(order => {

                    const sellerItems =
                        order.items.filter(
                            item =>
                                item.sellerId ===
                                sellerId
                        );


                    if (
                        sellerItems.length ===
                        0
                    ) {

                        return null;

                    }


                    const sellerProductTotal =
                        sellerItems.reduce(
                            (sum, item) =>
                                sum +
                                item.itemTotal,
                            0
                        );


                    const sellerDelivery =
                        sellerItems.length > 0
                            ? Number(
                                sellerItems[0]
                                    .deliveryCharge ||
                                0
                              )
                            : 0;


                    return {

                        orderId:
                            order.id,

                        customerName:
                            order.customerName,

                        phone:
                            order.phone,

                        deliveryAddress:
                            order.deliveryAddress,

                        paymentMethod:
                            order.paymentMethod,

                        orderStatus:
                            order.orderStatus,

                        productTotal:
                            sellerProductTotal,

                        deliveryCharge:
                            sellerDelivery,

                        total:
                            sellerProductTotal +
                            sellerDelivery,

                        items:
                            sellerItems,

                        createdAt:
                            order.createdAt

                    };

                })
                .filter(Boolean);


        res.json({

            success: true,

            count:
                sellerOrders.length,

            orders:
                sellerOrders

        });

    }
);


// ======================================================
// UPDATE ORDER STATUS
// ======================================================

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
            cleanText(
                req.body.status
            );


        const allowedStatuses = [

            "ORDER_CONFIRMED",

            "PROCESSING",

            "SHIPPED",

            "OUT_FOR_DELIVERY",

            "DELIVERED",

            "CANCELLED"

        ];


        if (
            !allowedStatuses.includes(
                status
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid Order Status।"

            });

        }


        order.orderStatus =
            status;


        order.updatedAt =
            new Date().toISOString();


        res.json({

            success: true,

            message:
                "Order Status Update হয়েছে।",

            order

        });

    }
);


// ======================================================
// CANCEL ORDER
// ======================================================

app.post(
    "/api/orders/:id/cancel",
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


        if (
            order.orderStatus ===
            "DELIVERED"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Delivered Order Cancel করা যাবে না।"

            });

        }


        if (
            order.orderStatus ===
            "CANCELLED"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Order ইতিমধ্যে Cancel করা হয়েছে।"

            });

        }


        /*
         * Return stock
         */

        for (
            const item of order.items
        ) {

            const product =
                products.find(
                    p =>
                        p.id ===
                        item.productId
                );


            if (product) {

                product.stock +=
                    item.quantity;

            }

        }


        order.orderStatus =
            "CANCELLED";


        order.updatedAt =
            new Date().toISOString();


        res.json({

            success: true,

            message:
                "Order Cancel হয়েছে।",

            order

        });

    }
);


// ======================================================
// ALL ORDERS
// ======================================================

app.get(
    "/api/orders",
    (req, res) => {

        res.json({

            success: true,

            count:
                orders.length,

            orders

        });

    }
);


// ======================================================
// ADMIN SUMMARY
// ======================================================

app.get(
    "/api/admin/summary",
    (req, res) => {

        const activeProducts =
            products.filter(
                product =>
                    product.status ===
                    "ACTIVE"
            );


        const confirmedOrders =
            orders.filter(
                order =>
                    order.orderStatus !==
                    "CANCELLED"
            );


        const totalSales =
            confirmedOrders.reduce(
                (sum, order) =>
                    sum +
                    order.grandTotal,
                0
            );


        res.json({

            success: true,

            summary: {

                users:
                    users.length,

                products:
                    activeProducts.length,

                orders:
                    orders.length,

                totalSales,

                paymentMethod:
                    "CASH_ON_DELIVERY"

            }

        });

    }
);


// ======================================================
// 404
// ======================================================

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "API endpoint পাওয়া যায়নি।",

            path:
                req.originalUrl

        });

    }
);


// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
    (err, req, res, next) => {

        console.error(err);

        res.status(500).json({

            success: false,

            message:
                "Server error হয়েছে।"

        });

    }
);


// ======================================================
// START SERVER
// ======================================================

app.listen(
    PORT,
    () => {

        console.log(
            `Dhaka Bazar Backend running on port ${PORT}`
        );

        console.log(
            "OTP:",
            TWILIO_VERIFY_SERVICE_SID
                ? "Twilio configured"
                : "Twilio NOT configured"
        );

    }
);
