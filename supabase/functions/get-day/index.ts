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
    const { profile_id, role } = await requireAuth(req);

    const { date } = await req.json();

    if (!date) {
      return new Response(JSON.stringify({ error: 'Date is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabaseClient
      .from('bookings')
      .select('*, customers(*)')
      .eq('date', date)
      .neq('status', 'cancelled');

    const { data: incomes, error: incomesError } = await supabaseClient
      .from('other_income')
      .select('*')
      .eq('business_date', date);

    if (error) throw error;
    if (incomesError) throw incomesError;

    return new Response(JSON.stringify({ success: true, bookings: data, incomes }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
