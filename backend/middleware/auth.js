// ======================================================
// CAMPORA JWT AUTH MIDDLEWARE
// ======================================================

const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {

    try {

        // ==========================================
        // GET TOKEN
        // ==========================================

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {

            return res.status(401).json({

                success: false,

                message: "Access denied. Token missing."

            });

        }

        const token = authHeader.split(" ")[1];

        // ==========================================
        // VERIFY TOKEN
        // ==========================================

        const decoded = jwt.verify(

            token,

            process.env.JWT_SECRET

        );

        // ==========================================
        // SAVE USER
        // ==========================================

        req.user = decoded;
        req.user.id = decoded.id || decoded.userId || decoded._id;

        if (!req.user.id) {

            return res.status(401).json({

                success: false,
                message: "Invalid token payload."

            });

        }

        return next();

    }

    catch (error) {

        return res.status(401).json({

            success: false,

            message: "Invalid or expired token."

        });

    }

};
