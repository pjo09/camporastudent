# CAMPORA Phase 6 — Database Cutover Rollback Plan

## Executive Summary
This document specifies the immediate, zero-downtime rollback procedures if any anomaly is observed when switching database providers.

---

## 1. Rollback Trigger Criteria
A rollback must be initiated immediately if any of the following occur:
1. HTTP 5xx error rate spikes above 0.1% after database switch.
2. Latency increases by > 100ms.
3. Inventory inconsistency detected (`available_beds < 0`).
4. Any authentication failure for approved owners (`account_status = ACTIVE`).
5. Database connection pool exhaustion or query timeouts.

---

## 2. Immediate Rollback Procedure (< 1 Minute Execution)

### Step 1: Revert Environment Variable
Set `DATABASE_PROVIDER` back to `mongodb` in Render environment:
```bash
DATABASE_PROVIDER=mongodb
```

### Step 2: Trigger Instant Application Restart
Because all routes depend on `backend/config/database.js` and repository adapters, restarting the Express application instantly routes 100% of read and write traffic back to MongoDB Atlas.

---

## 3. Data Reconciliation Procedures

### A. Inventory Reconciliation
- Query all property `available_beds` in MongoDB.
- Recalculate against active bookings (`bookingStatus = 'confirmed'`).
- Ensure no bed count drift occurred during cutover window.

### B. Booking Reconciliation
- Verify all pending or confirmed bookings created during Supabase testing window are synced back to MongoDB.

### C. Owner Approval Reconciliation
- Verify `accountStatus` in MongoDB remains authoritative (`atharwacto@gmail.com = ACTIVE`).

---

## 4. Rollback Verification Check
Run regression test suite:
```bash
node backend/test/owner_approval_regression.test.js
node backend/scratch/compare_mongodb_supabase.js
```
- Expected Result: **100% PASS**
