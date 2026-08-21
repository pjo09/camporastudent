const dbConfig = require('../config/database');
const mongoUserAdapter = require('../database/mongodb/userAdapter');
const supabaseUserAdapter = require('../database/supabase/userAdapter');
const { executeShadowRead } = require('../services/shadowReadService');

function compareUserFields(mongoUser, supabaseUser) {
    const mismatches = [];

    if (!mongoUser && !supabaseUser) return mismatches;

    if (mongoUser && !supabaseUser) {
        mismatches.push({ field: 'existence', mongoValue: 'EXISTS', supabaseValue: 'MISSING', mongoId: mongoUser._id?.toString() });
        return mismatches;
    }

    if (!mongoUser && supabaseUser) {
        mismatches.push({ field: 'existence', mongoValue: 'MISSING', supabaseValue: 'EXISTS', mongoId: supabaseUser.id });
        return mismatches;
    }

    const mId = mongoUser._id ? mongoUser._id.toString() : 'N/A';

    // Email
    const mEmail = (mongoUser.email || '').toLowerCase().trim();
    const sEmail = (supabaseUser.email || '').toLowerCase().trim();
    if (mEmail !== sEmail) {
        mismatches.push({ field: 'email', mongoValue: mEmail, supabaseValue: sEmail, mongoId: mId, severity: 'HIGH' });
    }

    // Authoritative Approval Status
    const mAccStatus = mongoUser.accountStatus || 'ACTIVE';
    const sAccStatus = supabaseUser.accountStatus || 'ACTIVE';
    if (mAccStatus !== sAccStatus) {
        mismatches.push({ field: 'accountStatus', mongoValue: mAccStatus, supabaseValue: sAccStatus, mongoId: mId, severity: 'CRITICAL' });
    }

    // Role
    if ((mongoUser.role || '').toLowerCase() !== (supabaseUser.role || '').toLowerCase()) {
        mismatches.push({ field: 'role', mongoValue: mongoUser.role, supabaseValue: supabaseUser.role, mongoId: mId, severity: 'HIGH' });
    }

    // Verified
    if (!!mongoUser.verified !== !!supabaseUser.verified) {
        mismatches.push({ field: 'verified', mongoValue: !!mongoUser.verified, supabaseValue: !!supabaseUser.verified, mongoId: mId, severity: 'MEDIUM' });
    }

    // Status
    if ((mongoUser.status || '').toLowerCase() !== (supabaseUser.status || '').toLowerCase()) {
        mismatches.push({ field: 'status', mongoValue: mongoUser.status, supabaseValue: supabaseUser.status, mongoId: mId, severity: 'MEDIUM' });
    }

    return mismatches;
}

async function findUserByEmail(email) {
    return await executeShadowRead({
        domain: 'users',
        operation: 'findUserByEmail',
        mongoRead: async () => await mongoUserAdapter.findUserByEmail(email),
        supabaseRead: async () => await supabaseUserAdapter.findUserByEmail(email),
        compareFields: compareUserFields
    });
}

async function findUserById(id) {
    return await executeShadowRead({
        domain: 'users',
        operation: 'findUserById',
        mongoRead: async () => await mongoUserAdapter.findUserById(id),
        supabaseRead: async () => await supabaseUserAdapter.findUserById(id),
        compareFields: compareUserFields
    });
}

async function createUser(userData) {
    if (dbConfig.isSupabase()) {
        return await supabaseUserAdapter.createUser(userData);
    }
    return await mongoUserAdapter.createUser(userData);
}

async function updateUser(id, updates) {
    if (dbConfig.isSupabase()) {
        return await supabaseUserAdapter.updateUser(id, updates);
    }
    return await mongoUserAdapter.updateUserApprovalStatus(id, updates.accountStatus || 'ACTIVE');
}

async function updateUserApprovalStatus(id, accountStatus) {
    if (dbConfig.isSupabase()) {
        return await supabaseUserAdapter.updateUserApprovalStatus(id, accountStatus);
    }
    return await mongoUserAdapter.updateUserApprovalStatus(id, accountStatus);
}

module.exports = {
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    updateUserApprovalStatus
};
