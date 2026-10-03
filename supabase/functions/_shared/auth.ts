import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";

export async function requireAuth(req: Request) {
  const token = req.headers.get('x-session-token');
  if (!token) {
    throw new Error('Unauthorized');
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data, error } = await supabaseClient
    .from('app_sessions')
    .select('profile_id, role, expires_at')
    .eq('token', token)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Unauthorized');
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error('Unauthorized: Session expired');
  }

  return { profile_id: data.profile_id, role: data.role };
}

export function handleAuthError(err: any, corsHeaders: any) {
  if (err.message.includes('Unauthorized')) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ error: err.message }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
