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
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: result, error: rpcError } = await supabaseClient.rpc('cancel_booking_txn', {
      p_booking_id: booking_id
    });

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message || 'Transaction failed' }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, credited: result.credited }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error("Booking Edge Function Error:", err);
    if (err.message?.includes('Unauthorized')) {
      return handleAuthError(err, corsHeaders);
    }
    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred" }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
