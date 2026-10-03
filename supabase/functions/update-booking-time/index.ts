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
    const { booking_id, actual_check_in, actual_check_out, status, note } = await req.json();

    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: any = {};
    if (actual_check_in !== undefined) payload.actual_check_in = actual_check_in;
    if (actual_check_out !== undefined) payload.actual_check_out = actual_check_out;
    if (status !== undefined) payload.status = status;
    if (note !== undefined) payload.note = note;

    const { error } = await supabaseClient
      .from('bookings')
      .update(payload)
      .eq('id', booking_id);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
