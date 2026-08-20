# CAMPORA Area-Based Admin Access Architecture Plan

## Executive Summary
This document provides the technical design, PostgreSQL schema, authorization middleware, route updates, migration strategy, and test plan for introducing **Geographic / Area-Based Administration** into CAMPORA.

---

## 1. Business Objectives
Currently, CAMPORA supports a single global `admin` role. As CAMPORA scales across multiple states and cities, administrative operations (property approval, owner verification, booking oversight, reviews, and audit logs) must be scoped geographically to regional administrators (e.g. North, South, West, East India, or specific States/Cities) while retaining global oversight for `SUPER_ADMIN`.

---

## 2. Proposed PostgreSQL Database Schema (`013_area_admin_permissions.sql`)

```sql
-- Migration 013: Area-Based Admin Permissions Schema
CREATE TABLE IF NOT EXISTS admin_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    admin_type VARCHAR DEFAULT 'AREA_ADMIN' CHECK (admin_type IN ('SUPER_ADMIN', 'AREA_ADMIN')),
    scope_type VARCHAR NOT NULL CHECK (scope_type IN ('GLOBAL', 'REGION', 'STATE', 'CITY')),
    scope_value VARCHAR NOT NULL DEFAULT '', -- e.g. 'Maharashtra', 'Mumbai', 'North India'
    created_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (admin_id, scope_type, scope_value)
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_admin ON admin_permissions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_scope ON admin_permissions(scope_type, scope_value);
```

---

## 3. Server-Side Authorization Middleware (`backend/middleware/areaAdminAuth.js`)

```js
const { getSupabaseClient } = require('../config/supabase');

/**
 * Middleware enforcing Area-Based Access Control for Admins.
 * Inspects req.user (from JWT) and checks geographic scope against requested resource location.
 */
async function requireAreaAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Access denied. Admin role required." });
    }

    const db = await getSupabaseClient();
    
    // Check if user has SUPER_ADMIN or GLOBAL permission
    const permRes = await db.query(`
        SELECT * FROM admin_permissions WHERE admin_id = $1
    `, [req.user.id]);

    const perms = permRes.rows;
    const isSuperAdmin = perms.some(p => p.admin_type === 'SUPER_ADMIN' || p.scope_type === 'GLOBAL');

    if (isSuperAdmin) {
        req.adminScope = { isGlobal: true };
        return next();
    }

    // Extract allowed states and cities for area admin
    const allowedStates = perms.filter(p => p.scope_type === 'STATE').map(p => p.scope_value.toLowerCase());
    const allowedCities = perms.filter(p => p.scope_type === 'CITY').map(p => p.scope_value.toLowerCase());

    req.adminScope = {
        isGlobal: false,
        allowedStates,
        allowedCities
    };

    next();
}

module.exports = { requireAreaAdmin };
```

---

## 4. Affected Routes & Geographic Filtering Logic

| Route Category | Scoping Parameter | Authorization Enforcement |
| :--- | :--- | :--- |
| `GET /api/admin/properties` | `property.state`, `property.city` | Filter query parameters to allowed states/cities only. Attempting to fetch explicit property ID outside area returns HTTP 403. |
| `PUT /api/admin/properties/:id/approve` | Property location | Verify property location against `req.adminScope` before modifying status. |
| `GET /api/admin/bookings` | `booking.property_id` | Join `properties` table and filter bookings by property state/city. |
| `POST /api/admin/users/:id/approve` | Owner property locations | Verify owner's business city/state or property city/state matches admin scope. |
| `GET /api/admin/audit-logs` | Resource location | Filter log entries linked to properties within admin scope. |

---

## 5. Security Invariants & Escalation Protections

1. **Server-Side Enforcement**: Area checks are executed on the backend API layer. Frontend filtering is cosmetic only.
2. **Privilege Escalation Prevention**:
   - `AREA_ADMIN` cannot assign or modify `admin_permissions`.
   - `AREA_ADMIN` cannot promote students/owners to `admin` or alter user roles.
   - `AREA_ADMIN` querying cross-regional IDs receives HTTP 403 Forbidden.
3. **Super Admin Isolation**: Only `SUPER_ADMIN` can create, modify, or revoke permissions in `admin_permissions`.

---

## 6. Migration & Rollback Strategy

- **Migration**: Deploy migration file `013_area_admin_permissions.sql`. Automatically populate default `SUPER_ADMIN` scope for existing admin `atharwacto@gmail.com`.
- **Rollback**: If rollback is required, dropping `admin_permissions` table and reverting `requireAreaAdmin` back to standard admin check restores existing behavior without data loss.

---

## 7. Automated Test Plan (`backend/test/area_admin_security.test.js`)

1. Test Super Admin cross-regional read/write (Delhi + Maharashtra): PASS (200 OK).
2. Test North Admin accessing Delhi property: PASS (200 OK).
3. Test North Admin attempting to access Maharashtra property: PASS (403 Forbidden).
4. Test Area Admin attempting privilege escalation (granting self Super Admin): PASS (403 Forbidden).
