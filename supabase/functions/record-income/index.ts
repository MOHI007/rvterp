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
    const { profile_id } = await requireAuth(req); // Manager or Admin

    const { business_date, amount, method, category, note } = await req.json();

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: corsHeaders });
    }
    if (!['Cash', 'bKash', 'Nagad'].includes(method)) {
      return new Response(JSON.stringify({ error: 'Invalid method' }), { status: 400, headers: corsHeaders });
    }
    if (!category) {
      return new Response(JSON.stringify({ error: 'Category is required' }), { status: 400, headers: corsHeaders });
    }

    let bDate = business_date;
    if (!bDate) {
      // Default to today based on Dhaka offset
      const d = new Date();
      const offset = d.getTimezoneOffset() * 60000;
      const bdTime = new Date(d.getTime() + offset + (6 * 3600000));
      const hours = bdTime.getHours();
      // If before 6 AM, it belongs to previous business day
      if (hours < 6) {
        bdTime.setDate(bdTime.getDate() - 1);
      }
      bDate = bdTime.toISOString().split('T')[0];
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabaseClient
      .from('other_income')
      .insert({
        business_date: bDate,
        amount,
        method,
        category,
        note,
        recorded_by: profile_id
      })
      .select('*')
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, income: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
