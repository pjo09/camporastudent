// =====================================================
// CAMPORA SUPABASE EDGE FUNCTION — RAZORPAY PAYMENT CREATION
// Server-side payment order creation (Denos / Serverless)
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    try {
        const { bookingId, amount } = await req.json()

        if (!bookingId || !amount) {
            return new Response(JSON.stringify({ error: 'Missing bookingId or amount' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') || 'rzp_test_placeholder';
        const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || 'rzp_secret_placeholder';

        // Mock Razorpay order payload
        const razorpayOrder = {
            id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            entity: 'order',
            amount: amount * 100, // amount in paise
            amount_paid: 0,
            amount_due: amount * 100,
            currency: 'INR',
            receipt: `receipt_${bookingId}`,
            status: 'created',
            attempts: 0,
            created_at: Math.floor(Date.now() / 1000)
        };

        // Initialize Supabase admin client with service-role key (server-side only!)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || 'https://wsldciqtznqjnmltgxpm.supabase.co',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'placeholder_service_role'
        );

        // Store payment order record in invoices table
        await supabase.from('invoices').insert({
            booking_id: bookingId,
            razorpay_order_id: razorpayOrder.id,
            amount: amount,
            status: 'pending'
        });

        return new Response(JSON.stringify(razorpayOrder), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
});
