const enabled = process.env.DATABASE_SHADOW_READS === 'true';
const shadowDomains = (process.env.SHADOW_READ_DOMAINS || 'users,properties,bookings').split(',').map(s => s.trim().toLowerCase());

module.exports = {
    enabled,
    shadowDomains,
    isEnabledForDomain: (domain) => {
        if (!enabled) return false;
        return shadowDomains.includes('*') || shadowDomains.includes(domain.toLowerCase());
    }
};
