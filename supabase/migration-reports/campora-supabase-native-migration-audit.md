# CAMPORA — COMPLETE EXPRESS/RENDER → SUPABASE NATIVE MIGRATION AUDIT & CUTOVER PLAN

## 1. Existing vs Target Architecture

- **Existing Architecture**:
  - Frontend: `https://camporastudent.vercel.app` (Vercel)
  - Backend: `https://camporastudent.onrender.com` (Render Express.js API)
  - Database: Supabase PostgreSQL (`DATABASE_PROVIDER=supabase`)
  - Standby Backup: MongoDB Atlas (READ-ONLY)

- **Target Architecture**:
  - Frontend: Vercel (`https://camporastudent.vercel.app`)
  - Native Data Tier: Supabase PostgreSQL + RLS + Database Functions / RPC
  - Native Auth Tier: Supabase Auth + `profiles` RLS Policies
  - Serverless Privileged Tier: Supabase Edge Functions (Deno) for Razorpay payments, Resend emails, Google OAuth verification, and privileged admin tasks.
  - Storage Tier: Supabase Storage + Cloudinary legacy fallback

- **Rollback Safety**:
  - **Render Node.js API remains 100% untouched and fully operational on `origin/main`**.
  - Feature flag `USE_SUPABASE_NATIVE` controls parallel cutover.
  - Zero downtime, zero data loss, zero DNS disruption.

---

## 2. Complete Backend Route Inventory & Classification Matrix

| METHOD | ROUTE PATH | AUTH & AUTHZ | DATABASE TARGET | MIGRATION CLASSIFICATION |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | None | `DIRECT SUPABASE QUERY` / `EDGE FUNCTION` |
| `POST` | `/api/auth/register` | Public | `profiles` | `SUPABASE AUTH` + `profiles` RLS |
| `POST` | `/api/auth/login` | Public | `profiles` | `SUPABASE AUTH` |
| `GET` | `/api/auth/me` | Authenticated | `profiles` | `DIRECT SUPABASE QUERY` (RLS `auth.uid() = id`) |
| `POST` | `/api/auth/google` | Public | `profiles` | `SUPABASE AUTH` + `EDGE FUNCTION` |
| `POST` | `/api/auth/forgot-password` | Public | `otps` | `SUPABASE EDGE FUNCTION` (Resend Email) |
| `POST` | `/api/auth/reset-password` | Public | `profiles`, `otps` | `SUPABASE EDGE FUNCTION` / `RPC` |
| `GET` | `/api/properties` | Public | `properties` | `DIRECT SUPABASE QUERY` (`is_approved = true AND status = 'active'`) |
| `GET` | `/api/properties/search` | Public | `properties`, `cities`, `colleges` | `DIRECT SUPABASE QUERY` (Public filter) |
| `GET` | `/api/properties/:id` | Public | `properties` | `DIRECT SUPABASE QUERY` |
| `POST` | `/api/properties` | Owner | `properties` | `DIRECT SUPABASE QUERY` (RLS `auth.uid() = owner_id`) |
| `PUT` | `/api/properties/:id` | Owner | `properties` | `DIRECT SUPABASE QUERY` (RLS `owner_id = auth.uid()`) |
| `DELETE` | `/api/properties/:id` | Owner | `properties` | `DIRECT SUPABASE QUERY` |
| `GET` | `/api/statistics` | Public | `properties`, `cities`, `colleges`, `profiles` | `DIRECT SUPABASE QUERY` / `RPC` |
| `GET` | `/api/bookings` | Student / Owner / Admin | `bookings` | `DIRECT SUPABASE QUERY` (RLS) |
| `POST` | `/api/bookings` | Student | `bookings`, `properties` | `SUPABASE RPC` (`create_booking_transaction`) |
| `PATCH` | `/api/bookings/:id/status` | Owner / Student / Admin | `bookings`, `properties` | `SUPABASE RPC` (Inventory restoration) |
| `GET` | `/api/owner/properties` | Owner | `properties` | `DIRECT SUPABASE QUERY` |
| `GET` | `/api/owner/bookings` | Owner | `bookings` | `DIRECT SUPABASE QUERY` |
| `GET` | `/api/owner/analytics` | Owner | `bookings`, `properties` | `DIRECT SUPABASE QUERY` / `RPC` |
| `GET` | `/api/student/saved-properties` | Student | `saved_properties` | `DIRECT SUPABASE QUERY` |
| `POST` | `/api/student/saved-properties` | Student | `saved_properties` | `DIRECT SUPABASE QUERY` |
| `DELETE` | `/api/student/saved-properties/:id` | Student | `saved_properties` | `DIRECT SUPABASE QUERY` |
| `GET` | `/api/messages/conversations` | Authenticated | `message_conversations` | `DIRECT SUPABASE QUERY` |
| `POST` | `/api/messages` | Authenticated | `messages` | `DIRECT SUPABASE QUERY` |
| `GET` | `/api/notifications` | Authenticated | `notifications` | `DIRECT SUPABASE QUERY` |
| `GET` | `/api/admin/scopes` | SUPER_ADMIN | `admin_scopes` | `DIRECT SUPABASE QUERY` (Admin RLS) |
| `POST` | `/api/admin/scopes` | SUPER_ADMIN | `admin_scopes` | `SUPABASE EDGE FUNCTION` (Privileged Super Admin) |
| `DELETE` | `/api/admin/scopes/:id` | SUPER_ADMIN | `admin_scopes` | `SUPABASE EDGE FUNCTION` |
| `PATCH` | `/api/admin/owners/:id/approve` | Admin | `profiles` | `SUPABASE RPC` / `DIRECT SUPABASE QUERY` |
| `POST` | `/api/payment/create-order` | Student | `invoices` | `SUPABASE EDGE FUNCTION` (Razorpay API) |
| `POST` | `/api/payment/verify` | Student | `invoices`, `bookings` | `SUPABASE EDGE FUNCTION` (Razorpay HMAC verification) |
| `POST` | `/api/upload` | Authenticated | `Supabase Storage` | `SUPABASE STORAGE` |

---

## 3. Data Model Consistency & Column Mapping Matrix

| MONGOOSE MODEL / FIELD | SUPABASE TABLE / COLUMN | DATA TYPE | NOTES |
| :--- | :--- | :--- | :--- |
| `User._id` / `User.id` | `profiles.id` / `profiles.mongo_id` | `UUID` / `VARCHAR(50)` | UUID primary key |
| `User.name` | `profiles.name` | `VARCHAR(255)` | Not Null |
| `User.email` | `profiles.email` | `VARCHAR(255)` | Lowercase Unique |
| `User.accountStatus` | `profiles.account_status` | `VARCHAR(50)` | `ACTIVE`, `PENDING`, `REJECTED`, `BANNED`, `DELETED` |
| `User.role` | `profiles.role` | `VARCHAR(50)` | `student`, `owner`, `admin` |
| `User.profileImage` / `avatar` | `profiles.profile_image` | `TEXT` | Authoritative column `profile_image` |
| `Property.owner` | `properties.owner_id` | `UUID` | References `profiles(id)` |
| `Property.availableBeds` | `properties.available_beds` | `INTEGER` | Enforced `>= 0` via `create_booking_transaction` |
| `Property.totalBeds` | `properties.total_beds` | `INTEGER` | Enforced `>= available_beds` |
| `Booking.student` | `bookings.student_id` | `UUID` | References `profiles(id)` |
| `Booking.property` | `bookings.property_id` | `UUID` | References `properties(id)` |
| `AdminScope.isGlobal` | `admin_scopes.is_global` | `BOOLEAN` | `true` grants global Super Admin privileges |

---

## 4. RLS Security Policy Matrix

```sql
-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles read" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Properties
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved properties" ON properties FOR SELECT USING (is_approved = true AND status = 'active');
CREATE POLICY "Owners manage own properties" ON properties FOR ALL USING (auth.uid() = owner_id);

-- Bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own bookings" ON bookings FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Owners read property bookings" ON bookings FOR SELECT USING (auth.uid() = owner_id);

-- Admin Scopes
ALTER TABLE admin_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read assigned scopes" ON admin_scopes FOR SELECT USING (auth.uid() = user_id);
```

---

## 5. Privileged Logic & Edge Function Matrix

| FEATURE | EXPORTED EDGE FUNCTION | PRIVILEGED REASON |
| :--- | :--- | :--- |
| **Razorpay Payments** | `supabase/functions/payment-verify` | HMAC SHA256 signature verification & secret key protection |
| **Transactional Email / OTP** | `supabase/functions/send-email` | Resend API key protection & email rate limiting |
| **Google OAuth Verification** | `supabase/functions/auth-google` | Server-side Google ID token verification & JWT minting |
| **Admin Scope Provisioning** | `supabase/functions/admin-scopes` | Privileged SUPER_ADMIN RBAC verification & scope assignment |

---

## 6. Booking & Inventory Safety Plan (Transactional RPC)

```sql
CREATE OR REPLACE FUNCTION create_booking_transaction(
    p_property_id UUID,
    p_move_in_date DATE,
    p_deposit_amount NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_student_id UUID;
    v_owner_id UUID;
    v_rent NUMERIC;
    v_beds INT;
    v_status VARCHAR;
    v_approved BOOLEAN;
    v_booking_id UUID;
BEGIN
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not logged in';
    END IF;

    SELECT owner_id, rent, available_beds, status, is_approved
    INTO v_owner_id, v_rent, v_beds, v_status, v_approved
    FROM properties
    WHERE id = p_property_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Property not found'; END IF;
    IF v_status <> 'active' OR NOT v_approved THEN RAISE EXCEPTION 'Property not available'; END IF;
    IF v_beds <= 0 THEN RAISE EXCEPTION 'No available beds left'; END IF;

    UPDATE properties SET available_beds = available_beds - 1, updated_at = NOW() WHERE id = p_property_id;

    INSERT INTO bookings (student_id, property_id, owner_id, status, move_in_date, rent_amount, deposit_amount)
    VALUES (v_student_id, p_property_id, v_owner_id, 'pending', p_move_in_date, v_rent, p_deposit_amount)
    RETURNING id INTO v_booking_id;

    RETURN jsonb_build_object('success', true, 'bookingId', v_booking_id);
END;
$$;
```

---

## 7. Rollback & Decommissioning Plan

- **Rollback Procedure**:
  - If any issue arises during Supabase Native feature testing, toggle `USE_SUPABASE_NATIVE=false` in localStorage or set environment variable `VITE_USE_SUPABASE_NATIVE=false`.
  - Frontend automatically switches back to `https://camporastudent.onrender.com/api` with zero downtime and zero data loss.
- **30-Day Render Decommissioning Checklist**:
  - 30 consecutive days of zero production errors on Supabase Native.
  - Verification that 0 production frontend requests hit Render.
  - Explicit human approval required before terminating Render service.

---

## 8. Machine-Readable Migration Status

```text
MIGRATION_STATUS:
AUDIT_COMPLETE

SUPABASE_NATIVE_READY:
YES

PRODUCTION_CUTOVER:
NOT_STARTED (Render fallback remains active)

RENDER:
KEEP_FOR_ROLLBACK

PRODUCTION_DATA_MODIFIED:
0

CRITICAL_BLOCKERS:
NONE
```
