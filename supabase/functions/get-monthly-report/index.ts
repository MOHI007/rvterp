import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { requireAuth, handleAuthError } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await requireAuth(req, ['admin']); // Strictly admin only
    const { year, month } = await req.json();

    if (!year || !month) {
      return new Response(JSON.stringify({ error: 'Year and month are required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Format strings for LIKE/gte comparisons
    const monthStr = month.toString().padStart(2, '0');
    const yearMonthStr = `${year}-${monthStr}`;
    const startStr = `${yearMonthStr}-01`;
    const tempDate = new Date(year, month, 0); // gets the last day of the month
    const endStr = `${yearMonthStr}-${tempDate.getDate().toString().padStart(2, '0')}`;

    // For expenses, we need to construct a window in UTC that maps to the BD time month boundaries
    const startDate = new Date(`${yearMonthStr}-01T06:00:00+06:00`);
    const endDate = new Date(startDate.getTime());
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    
    if (isNaN(startDate.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid date format' }), { status: 400, headers: corsHeaders });
    }

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const [
      { data: payments, error: pError },
      { data: expenses, error: eError },
      { data: incomes, error: iError }
    ] = await Promise.all([
      // Sum up paid amounts from payments associated with bookings in that month
      supabaseClient
        .from('payments')
        .select('amount, method, bookings!inner(date, status)')
        .gte('bookings.date', startStr)
        .lte('bookings.date', endStr),
      // Expenses by created_at window
      supabaseClient
        .from('expenses')
        .select('amount')
        .gte('created_at', startIso)
        .lte('created_at', endIso),
      // Other income by business_date
      supabaseClient
        .from('other_income')
        .select('amount')
        .gte('business_date', startStr)
        .lte('business_date', endStr)
    ]);

    if (pError) throw pError;
    if (eError) throw eError;
    if (iError) throw iError;

    // Filter out cancelled bookings' payments just in case (though normally cancelled bookings shouldn't have successful payments)
    const validPayments = payments?.filter(p => p.bookings?.status !== 'cancelled') || [];
    
    const totalBookingIncome = validPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const totalExpenses = expenses?.reduce((acc, e) => acc + (e.amount || 0), 0) || 0;
    const totalOtherIncome = incomes?.reduce((acc, i) => acc + (i.amount || 0), 0) || 0;
    const netProfit = totalBookingIncome + totalOtherIncome - totalExpenses;

    return new Response(JSON.stringify({ 
      success: true, 
      totalBookingIncome, 
      totalExpenses, 
      totalOtherIncome, 
      netProfit 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    // Return 200 with structured JSON to avoid CORS swallowing actual errors
    return new Response(JSON.stringify({ success: false, error: err.message }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
