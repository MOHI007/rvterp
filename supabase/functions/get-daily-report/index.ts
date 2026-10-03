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
    await requireAuth(req);
    const { date } = await req.json();

    if (!date) {
      return new Response(JSON.stringify({ error: 'Date is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // F-A Window Fix: Server runs in UTC. Explicitly append +06:00 offset to
    // build the window correctly for Dhaka time, otherwise 06:00-12:00 local payments are dropped.
    const startDate = new Date(`${date}T06:00:00+06:00`);
    const endDate = new Date(startDate.getTime());
    endDate.setDate(endDate.getDate() + 1);
    endDate.setMilliseconds(endDate.getMilliseconds() - 1);
    
    if (isNaN(startDate.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid date format' }), { status: 400, headers: corsHeaders });
    }

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const [
      { data: bookings, error: bError },
      { data: payments, error: pError },
      { data: expenses, error: eError },
      { data: incomes, error: iError }
    ] = await Promise.all([
      supabaseClient
        .from('bookings')
        .select('*, customers(name)')
        .eq('date', date)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true }),
      supabaseClient
        .from('payments')
        .select('*, bookings(date, status)')
        .gte('created_at', startIso)
        .lte('created_at', endIso),
      supabaseClient
        .from('expenses')
        .select('*')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true }),
      supabaseClient
        .from('other_income')
        .select('*')
        .eq('business_date', date)
        .order('created_at', { ascending: true })
    ]);

    if (bError) throw bError;
    if (pError) throw pError;
    if (eError) throw eError;
    if (iError) throw iError;

    return new Response(JSON.stringify({ success: true, bookings, payments, expenses, incomes }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
