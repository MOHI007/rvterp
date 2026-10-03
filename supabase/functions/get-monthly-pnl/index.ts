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
    const { role } = await requireAuth(req);
    
    // Monthly report is admin-only
    if (role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can view monthly report' }), { status: 403, headers: corsHeaders });
    }

    const { start_date, end_date } = await req.json();

    if (!start_date || !end_date) {
      return new Response(JSON.stringify({ error: 'start_date and end_date are required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const startDateObj = new Date(`${start_date}T06:00:00`);
    const endDateObj = new Date(`${end_date}T06:00:00`);
    endDateObj.setDate(endDateObj.getDate() + 1);
    endDateObj.setHours(5, 59, 59, 999);
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid date format' }), { status: 400, headers: corsHeaders });
    }

    const startIso = startDateObj.toISOString();
    const endIso = endDateObj.toISOString();

    const [
      { data: bookings, error: bError },
      { data: payments, error: pError },
      { data: expenses, error: eError }
    ] = await Promise.all([
      supabaseClient
        .from('bookings')
        .select('*')
        .gte('date', start_date)
        .lte('date', end_date)
        .neq('status', 'cancelled')
        .order('date', { ascending: true }),
      supabaseClient
        .from('payments')
        .select('*, bookings(date)')
        .gte('created_at', startIso)
        .lte('created_at', endIso),
      supabaseClient
        .from('expenses')
        .select('*')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
    ]);

    if (bError) throw bError;
    if (pError) throw pError;
    if (eError) throw eError;

    return new Response(JSON.stringify({ success: true, bookings, payments, expenses }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
