// ======================================================
// CAMPORA ROLE-BASED ACCESS CONTROL (RBAC) MIDDLEWARE
// ======================================================

module.exports = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Authentication required.",
                error: "UNAUTHORIZED"
            });
        }

        const userRole = req.user.role.toLowerCase();
        const normalizedRoles = allowedRoles.map(r => r.toLowerCase());

        // ADMINs have global access override
        if (userRole === "admin" || normalizedRoles.includes(userRole)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: `Forbidden: Access restricted for ${req.user.role} role.`,
            error: "FORBIDDEN"
        });
    };
};
