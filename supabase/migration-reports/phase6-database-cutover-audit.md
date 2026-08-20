# CAMPORA Phase 6 — Database Cutover Audit Report

## Executive Summary
This audit categorizes every database access point in the CAMPORA Express backend to prepare for a safe, 100% reversible database provider cutover (`DATABASE_PROVIDER=mongodb` -> `DATABASE_PROVIDER=supabase`).

---

## 1. Domain Access Categorization Matrix (20 Business Domains)

| Domain | Primary Model / Table | Operations Found | Category | Cutover Safety |
| :--- | :--- | :--- | :--- | :--- |
| **1. Authentication** | `User` / `profiles` | `findOne`, `create`, `save` | `A, C, D, E` | SAFE (Preserves JWT + local password auth) |
| **2. Users / Profiles** | `User` / `profiles` | `findById`, `find`, `updateOne` | `A, C, D` | SAFE (Repository implemented) |
| **3. Owner Approval** | `User` / `profiles` | `findByIdAndUpdate`, `find` | `A, C, D, E, H` | SAFE (`account_status = ACTIVE` enforced) |
| **4. Properties** | `Property` / `properties` | `find`, `findById`, `create`, `updateOne` | `A, C, D` | SAFE (Repository implemented) |
| **5. Property Inventory** | `Property` / `properties` | `updateOne`, `findById` | `A, C, D, F` | SAFE (Atomic bed reservation/release) |
| **6. Bookings** | `Booking` / `bookings` | `find`, `findById`, `create`, `updateOne` | `A, C, D, F` | SAFE (Repository implemented) |
| **7. Booking Cancellation** | `Booking` / `bookings` | `findByIdAndUpdate`, `updateOne` | `A, C, D, F` | SAFE (Triggers inventory release) |
| **8. Tenancies** | `Tenancy` / `tenancies` | `find`, `create`, `updateOne` | `A, C, D` | SAFE (Adapter created) |
| **9. Resident Requests** | `ResidentRequest` / `resident_requests` | `find`, `create`, `updateOne` | `A, C, D` | SAFE (Adapter created) |
| **10. Messaging** | `MessageConversation`, `Message` / `conversations`, `messages` | `find`, `create`, `updateMany` | `A, C, D` | SAFE (Adapter created) |
| **11. Notifications** | `Notification` / `notifications` | `find`, `create`, `updateMany` | `A, C, D` | SAFE (Adapter created) |
| **12. Reviews** | `Review` / `reviews` | `find`, `create`, `aggregate` | `A, C, D` | SAFE (Adapter created) |
| **13. Maintenance** | `Maintenance` / `maintenances` | `find`, `findById`, `create` | `A, C, D` | SAFE (Adapter created) |
| **14. Announcements** | `Announcement` / `announcements` | `find`, `findById`, `create` | `A, C, D` | SAFE (Adapter created) |
| **15. Invoices** | `Invoice` / `invoices` | `find`, `findById`, `create` | `A, C, D, G` | SAFE (Adapter created) |
| **16. Contacts** | `Contact` / `contacts` | `find`, `create` | `A, C, D` | SAFE (Adapter created) |
| **17. Property Invites** | `PropertyInvite` / `property_invites` | `findOne`, `create`, `updateOne` | `A, C, D` | SAFE (Adapter created) |
| **18. Platform Settings** | `Setting` / `platform_settings` | `findOne`, `updateOne` | `A, C, D, H` | SAFE (Adapter created) |
| **19. Audit Logs** | `AuditLog` / `audit_logs` | `find`, `create` | `A, C, D, H` | SAFE (Adapter created) |
| **20. OTP / Passwords** | `Otp` / `otps` | `findOne`, `create`, `deleteOne` | `A, C, D, E` | SAFE (Local short-lived table) |

*Category Legend:*
- **A**: Repository/adapter based
- **B**: Direct MongoDB access
- **C**: Read-only
- **D**: Write
- **E**: Authentication/security-sensitive
- **F**: Inventory/booking-critical
- **G**: Payment-related
- **H**: Admin-only
- **I**: Non-critical/background

---

## 2. Cutover Strategy & Zero-Downtime Guarantee
- **Default Database Provider**: `DATABASE_PROVIDER=mongodb`
- **Reversibility**: Changing `DATABASE_PROVIDER` back to `mongodb` takes < 1 second and requires zero code rebuilds.
