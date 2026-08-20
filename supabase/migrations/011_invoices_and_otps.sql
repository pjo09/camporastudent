-- ======================================================
-- MIGRATION 011: INVOICES & OTPS (Invoice and Otp Models)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    booking_id UUID NULL REFERENCES bookings(id) ON DELETE SET NULL,
    invoice_number VARCHAR NOT NULL UNIQUE,
    period_from TIMESTAMPTZ NOT NULL,
    period_to TIMESTAMPTZ NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    rent_amount NUMERIC(10,2) NOT NULL CHECK (rent_amount >= 0),
    maintenance_charge NUMERIC(10,2) DEFAULT 0 CHECK (maintenance_charge >= 0),
    electricity_charge NUMERIC(10,2) DEFAULT 0 CHECK (electricity_charge >= 0),
    food_charge NUMERIC(10,2) DEFAULT 0 CHECK (food_charge >= 0),
    other_charges NUMERIC(10,2) DEFAULT 0 CHECK (other_charges >= 0),
    discount NUMERIC(10,2) DEFAULT 0 CHECK (discount >= 0),
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    amount_paid NUMERIC(10,2) DEFAULT 0 CHECK (amount_paid >= 0),
    status VARCHAR DEFAULT 'pending' CHECK (status IN (
        'pending', 'success', 'failed', 'refunded', 'partial', 'paid', 'overdue', 'cancelled'
    )),
    payment_method VARCHAR DEFAULT 'Cash' CHECK (payment_method IN (
        'Cash', 'UPI', 'Card', 'Net Banking', 'Wallet', 'Razorpay'
    )),
    paid_at TIMESTAMPTZ NULL,
    transaction_id VARCHAR DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment transactions history subdocuments
CREATE TABLE IF NOT EXISTS invoice_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    method VARCHAR DEFAULT 'Cash',
    transaction_id VARCHAR DEFAULT '',
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    note TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL,
    code VARCHAR NOT NULL,
    purpose VARCHAR DEFAULT 'register' CHECK (purpose IN ('register', 'reset')),
    attempts INTEGER DEFAULT 0 CHECK (attempts >= 0),
    last_sent_at TIMESTAMPTZ DEFAULT NOW(),
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_owner_status_due ON invoices(owner_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_student_status ON invoices(student_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_property_status ON invoices(property_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_transactions_invoice_id ON invoice_transactions(invoice_id);

CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_created_at ON otps(created_at);
