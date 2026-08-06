const AuditLog = require("../models/AuditLog");

/**
 * Creates an Audit Log entry in MongoDB
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.userEmail
 * @param {string} params.role
 * @param {string} params.action
 * @param {string} params.resource
 * @param {string} [params.resourceId]
 * @param {Object} [params.details]
 * @param {Object} [params.req] Express Request object for IP extraction
 */
const logAudit = async ({ userId, userEmail = "", role, action, resource, resourceId = "", details = {}, req = null }) => {
    try {
        const ipAddress = req ? (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "") : "";
        await AuditLog.create({
            userId,
            userEmail,
            role,
            action,
            resource,
            resourceId,
            details,
            ipAddress
        });
    } catch (err) {
        console.error("Audit log error:", err.message);
    }
};

module.exports = logAudit;
