const provider = (process.env.DATABASE_PROVIDER || 'mongodb').toLowerCase().trim();

const ALLOWED_PROVIDERS = ['mongodb', 'supabase'];

if (!ALLOWED_PROVIDERS.includes(provider)) {
    throw new Error(`[INVALID_DATABASE_PROVIDER] '${provider}' is not supported. Must be one of: ${ALLOWED_PROVIDERS.join(', ')}`);
}

console.log(`Database provider initialized: ${provider.toUpperCase()}`);

module.exports = {
    provider,
    isMongo: () => provider === 'mongodb',
    isSupabase: () => provider === 'supabase'
};
