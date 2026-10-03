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

    const { id, amount, method, category, note, business_date } = await req.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), { status: 400, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch old data
    const { data: oldData, error: fetchError } = await supabaseClient
      .from('other_income')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !oldData) {
      return new Response(JSON.stringify({ error: 'Record not found' }), { status: 404, headers: corsHeaders });
    }

    const payload: any = {};
    if (amount !== undefined) payload.amount = amount;
    if (method !== undefined) payload.method = method;
    if (category !== undefined) payload.category = category;
    if (note !== undefined) payload.note = note;
    if (business_date !== undefined) payload.business_date = business_date;

    const { data: newData, error: updateError } = await supabaseClient
      .from('other_income')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    // Log to audit
    await supabaseClient.from('audit_log').insert({
      profile_id,
      action: 'update',
      table_name: 'other_income',
      record_id: id,
      old_data: oldData,
      new_data: newData
    });

    return new Response(JSON.stringify({ success: true, income: newData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return handleAuthError(err, corsHeaders);
  }
});
