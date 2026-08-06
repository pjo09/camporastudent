// ===============================================
// CAMPORA — DNS BOOTSTRAP (c-ares)
// ===============================================
// The MongoDB Node.js driver resolves `mongodb+srv://`
// connection strings with Node's c-ares resolver
// (dns.resolveSrv / dns.resolveTxt / dns.resolve4),
// NOT with the Windows DNS Client (Dnscache).
//
// On this development machine, c-ares server discovery
// returns `127.0.0.1` while no local service listens on
// UDP/TCP port 53. Every SRV/A query therefore fails
// with ECONNREFUSED even though Windows DNS (nslookup,
// ping, browsers) works correctly.
//
// This module forces c-ares to use working DNS servers
// BEFORE Mongoose attempts to connect, so MongoDB Atlas
// SRV/TXT lookups succeed.
//
// Priority:
//   1. `DNS_SERVERS` env var (comma separated) if set
//   2. Usable servers already discovered by c-ares
//   3. Hardcoded fallback: 8.8.8.8, 1.1.1.1
// ===============================================

const dns = require("dns");
const net = require("net");

const DEFAULT_SERVERS = ["8.8.8.8", "1.1.1.1"];

// A loopback address is never usable here: there is no
// local DNS daemon, so queries to 127.0.0.1:53 always
// fail with ECONNREFUSED.
function isUsableServer(ip) {
    if (typeof ip !== "string") return false;
    if (net.isIP(ip) === 0) return false;
    if (ip === "127.0.0.1" || ip === "::1") return false;
    if (ip.startsWith("127.")) return false;
    return true;
}

function resolveServers() {
    const override = process.env.DNS_SERVERS;
    if (override && override.trim()) {
        const list = override
            .split(",")
            .map((s) => s.trim())
            .filter((s) => net.isIP(s) !== 0);
        if (list.length > 0) {
            return { servers: list, source: "DNS_SERVERS environment override" };
        }
    }

    const discovered = dns.getServers().filter(isUsableServer);
    if (discovered.length > 0) {
        return { servers: discovered, source: "dns.getServers()" };
    }

    return {
        servers: [...DEFAULT_SERVERS],
        source: "fallback defaults (8.8.8.8, 1.1.1.1)"
    };
}

function configureDnsResolvers() {
    const { servers, source } = resolveServers();
    try {
        dns.setServers(servers);
        console.log(
            "🌐 DNS Bootstrap : using",
            JSON.stringify(dns.getServers()),
            `(${source})`
        );
        return true;
    } catch (err) {
        console.log("⚠️ DNS Bootstrap : could not set custom DNS servers.");
        console.log(err);
        return false;
    }
}

module.exports = { configureDnsResolvers, resolveServers, isUsableServer };

