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
    const { profile_id } = await requireAuth(req);
    const { amount, category, method, note } = await req.json();

    if (!amount || !category || !method) {
      return new Response(JSON.stringify({ error: 'amount, category, and method are required' }), { status: 400, headers: corsHeaders });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'amount must be positive' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabaseClient.from('expenses').insert({
      amount,
      category,
      method,
      note,
      recorded_by: profile_id
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, expense: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
