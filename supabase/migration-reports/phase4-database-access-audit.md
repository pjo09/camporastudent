# CAMPORA Phase 4 — Database Access Audit Report

## Executive Summary
This audit inspects every Mongoose schema, model query, route controller, and database access point across the `backend/` codebase to design a clean, decoupled Repository/Adapter pattern.

---

## 1. Mongoose Models Audited (19 Models)

| Model Name | Source File | Domain | Operations Found |
| :--- | :--- | :--- | :--- |
| **User** | `backend/models/User.js` | `users/auth` | `find`, `findOne`, `findById`, `create`, `updateOne`, `save` |
| **Property** | `backend/models/Property.js` | `properties` | `find`, `findOne`, `findById`, `create`, `updateOne`, `deleteOne`, `save`, `populate` |
| **Booking** | `backend/models/Booking.js` | `bookings` | `find`, `findOne`, `findById`, `create`, `updateOne`, `save`, `populate` |
| **Review** | `backend/models/Review.js` | `reviews` | `find`, `findById`, `create`, `updateOne`, `deleteOne`, `aggregate` |
| **MessageConversation** | `backend/models/Message.js` | `messaging` | `find`, `findOne`, `findById`, `create`, `updateOne`, `save` |
| **Message** | `backend/models/Message.js` | `messaging` | `find`, `findOne`, `create`, `updateMany` |
| **Tenancy** | `backend/models/Tenancy.js` | `tenancies` | `find`, `findOne`, `create`, `updateOne` |
| **ResidentRequest** | `backend/models/ResidentRequest.js` | `resident requests` | `find`, `findOne`, `create`, `updateOne` |
| **Notification** | `backend/models/Notification.js` | `notifications` | `find`, `create`, `updateMany`, `deleteOne` |
| **Maintenance** | `backend/models/Maintenance.js` | `maintenance` | `find`, `findById`, `create`, `updateOne` |
| **Announcement** | `backend/models/Announcement.js` | `announcements` | `find`, `findById`, `create`, `updateOne` |
| **Invoice** | `backend/models/Invoice.js` | `invoices` | `find`, `findById`, `create`, `updateOne` |
| **Otp** | `backend/models/Otp.js` | `OTP` | `findOne`, `create`, `deleteOne` |
| **AuditLog** | `backend/models/AuditLog.js` | `audit logs` | `find`, `create` |
| **State** | `backend/models/State.js` | `locations` | `find`, `create` |
| **City** | `backend/models/City.js` | `locations` | `find`, `create` |
| **College** | `backend/models/College.js` | `locations` | `find`, `create` |
| **Contact** | `backend/models/Contact.js` | `contacts` | `find`, `create`, `updateOne` |
| **PropertyInvite** | `backend/models/PropertyInvite.js` | `property invites` | `findOne`, `create`, `updateOne` |
| **Setting** | `backend/models/Setting.js` | `settings` | `findOne`, `updateOne` |

---

## 2. Total Database Access Points Audited by Route / Component

1. **`backend/routes/auth.js`**: User registration, login, OTP verification, password reset (`User`, `Otp`).
2. **`backend/routes/admin.js`**: Owner approval, verification, user ban/unban, property approval (`User`, `Property`, `Booking`, `AuditLog`).
3. **`backend/routes/properties.js`**: Property search, filtering, detail retrieval, creation, updates (`Property`, `Review`).
4. **`backend/routes/bookings.js`**: Booking creation, owner confirmation/rejection, cancellation (`Booking`, `Property`, `Notification`).
5. **`backend/routes/google.js`**: Google OAuth user creation and lookup (`User`).
6. **`backend/routes/owner.js`**: Property management, dashboard stats (`Property`, `Booking`, `User`).
7. **`backend/routes/student.js`**: Student dashboard, saved properties, recent views (`User`, `Booking`, `Property`).
8. **`backend/utils/inventoryHelper.js`**: Bed reservation and release logic (`Property`, `Booking`).

---

## 3. Recommended Abstraction Layer Architecture

```
Route / Controller
       │
       ▼
  Repository Interface (backend/repositories/)
       │
 ┌─────┴─────────────────────────┐
 │                               │
 ▼                               ▼
MongoDB Adapter            Supabase Adapter
(backend/database/mongodb) (backend/database/supabase)
```

- **Current Default**: `DATABASE_PROVIDER=mongodb`
- **Future Switchable Target**: `DATABASE_PROVIDER=supabase`
