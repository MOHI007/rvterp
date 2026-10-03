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
    
    if (role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can update customers' }), { status: 403, headers: corsHeaders });
    }

    const { phone_number, name, advance_balance } = await req.json();

    if (!phone_number) {
      return new Response(JSON.stringify({ error: 'phone_number is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: any = {};
    if (name !== undefined) payload.name = name;
    if (advance_balance !== undefined) payload.advance_balance = advance_balance;

    const { error } = await supabaseClient
      .from('customers')
      .update(payload)
      .eq('phone_number', phone_number);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
