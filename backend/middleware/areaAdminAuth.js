const { getSupabaseClient } = require('../config/supabase');
const userRepository = require('../repositories/userRepository');

async function requireAreaAdmin(req, res, next) {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const user = await userRepository.findUserById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Access denied. Admin role required." });
        }

        // Account status check
        if (user.accountStatus === 'BANNED' || user.accountStatus === 'DELETED' || user.accountStatus === 'REJECTED') {
            return res.status(403).json({ success: false, message: "Your admin account is inactive or blocked." });
        }

        const db = await getSupabaseClient();
        const paramId = String(user.id || req.user.id);

        const scopeRes = await db.query(`
            SELECT * FROM admin_scopes 
            WHERE (admin_user_id::text = $1 OR admin_user_id IN (SELECT id FROM profiles WHERE mongo_id = $1)) 
              AND is_active = true
        `, [paramId]);

        let scopes = scopeRes.rows;

        // Default fallback: Super admin email receives global scope if no explicit entry
        const isSuperAdminEmail = (user.email || '').toLowerCase().trim() === 'camporaforstudents@gmail.com';
        if (scopes.length === 0 && isSuperAdminEmail) {
            scopes = [{ scope_type: 'GLOBAL', state: '', city: '' }];
        }

        const isGlobal = scopes.some(s => s.scope_type === 'GLOBAL');
        const allowedStates = scopes.filter(s => s.state).map(s => s.state.toLowerCase().trim());
        const allowedCities = scopes.filter(s => s.city).map(s => s.city.toLowerCase().trim());

        req.adminScope = {
            isGlobal,
            allowedStates,
            allowedCities,
            scopes,
            canAccessLocation: (state, city) => {
                if (isGlobal) return true;
                const stateClean = (state || '').toLowerCase().trim();
                const cityClean = (city || '').toLowerCase().trim();
                if (allowedStates.length > 0 && allowedStates.includes(stateClean)) return true;
                if (allowedCities.length > 0 && allowedCities.includes(cityClean)) return true;
                return false;
            }
        };

        next();
    } catch (err) {
        console.error("areaAdminAuth Error:", err);
        return res.status(500).json({ success: false, message: "Internal server error during authorization." });
    }
}

async function requireSuperAdmin(req, res, next) {
    return requireAreaAdmin(req, res, () => {
        if (!req.adminScope || !req.adminScope.isGlobal) {
            return res.status(403).json({ success: false, message: "Super Admin privileges required for this operation." });
        }
        next();
    });
}

module.exports = {
    requireAreaAdmin,
    requireSuperAdmin
};
