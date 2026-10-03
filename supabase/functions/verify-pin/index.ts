import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json();

    if (!pin) {
      return new Response(JSON.stringify({ error: 'PIN is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting by IP to prevent brute force
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Locked for 15 minutes.' }), {
        status: 423,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabaseClient.rpc('verify_pin_rpc', { p_pin: pin });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data.success) {
      rateLimitCheck.increment(); // Record the failed attempt
      return new Response(JSON.stringify({ error: data.error }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    rateLimitCheck.reset(); // Reset on success

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
