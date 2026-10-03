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

    if (role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders });
    }

    const { id } = await req.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch old data for audit
    const { data: oldData, error: fetchError } = await supabaseClient
      .from('other_income')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !oldData) {
      return new Response(JSON.stringify({ error: 'Record not found' }), { status: 404, headers: corsHeaders });
    }

    const { error: deleteError } = await supabaseClient
      .from('other_income')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Log to audit
    await supabaseClient.from('audit_log').insert({
      profile_id,
      action: 'delete',
      table_name: 'other_income',
      record_id: id,
      old_data: oldData,
      new_data: null
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
