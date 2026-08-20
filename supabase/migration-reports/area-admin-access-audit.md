# CAMPORA Area-Based Admin Access Control Audit

## Executive Summary
This document provides the pre-flight architecture audit for adding **Area-Based Admin Access Control** to CAMPORA.

---

## 1. Existing Admin Architecture Audit

- **Current Admin Role**: Supported single `admin` role stored in `profiles.role` (`student`, `owner`, `admin`).
- **Current Admin Authentication**: Standard Express JWT authentication middleware (`backend/middleware/auth.js`).
- **Current Middleware Verification**: Admin routes (`backend/routes/admin.js`) verify `req.user.role === 'admin'`.
- **Database Abstraction Gap Identified**: Admin middleware in `backend/routes/admin.js` contained direct Mongoose call `User.findById()`. Upgrading to `userRepository.findUserById()` completes Supabase abstraction for admin authorization.

---

## 2. Target Area-Based Authorization Model

- **Roles Hierarchy**:
  - `SUPER_ADMIN`: Full global access across India. Can manage admins, create/assign area scopes, edit global platform settings, access global analytics.
  - `AREA_ADMIN`: Restricted to assigned geographic scopes (`GLOBAL`, `STATE`, `CITY`). Can manage properties, owners, bookings, and reviews within assigned area. Cannot create admins, alter admin roles, expand scope, or view cross-regional data.
- **Relational Scope Model**: Scope assignments are stored in a dedicated `admin_scopes` table supporting multi-area assignments (e.g. an admin assigned to both `Delhi` and `Uttar Pradesh`).
- **Server-Side Enforcement**: All geographic boundaries are strictly evaluated and enforced server-side in backend middleware (`requireAreaAdmin`) and repository queries. Frontend UI filtering is cosmetic only.

---

## 3. Affected Database Tables & Routes

- **New Table**: `admin_scopes` (`id`, `admin_user_id`, `scope_type`, `state`, `city`, `is_active`, `created_at`, `updated_at`).
- **Affected Routes**:
  - `GET /api/admin/properties`: Filtered by admin's authorized states/cities.
  - `GET /api/admin/bookings`: Scoped by property location.
  - `POST /api/admin/users/:id/approve`: Restricted to owners with properties in scope.
  - `GET /api/admin/analytics`: Scoped metrics calculation.
  - `GET /api/admin/audit-logs`: Scoped log entries.
  - `POST /api/admin/scopes`: Super Admin endpoint for managing admin geographic scopes.

---

## 4. Rollback Strategy
- Disabling `admin_scopes` check and reverting `requireAreaAdmin` back to standard admin check restores existing behavior without data loss. MongoDB rollback path remains intact.
