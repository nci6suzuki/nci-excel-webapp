function getConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/$/, ''), key: serviceRoleKey };
}

export function isSupabaseEnabled() {
  return Boolean(getConfig());
}

export async function supabaseRest(path, { method = 'GET', body, headers = {} } = {}) {
  const config = getConfig();
  if (!config) return null;

  const res = await fetch(`${config.url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[supabase:${method} ${path}] ${text || res.statusText}`);
  }
  return res;
}