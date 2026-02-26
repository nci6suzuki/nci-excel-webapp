const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
}

function buildUrl(path, query) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }
  return url;
}

export async function supabaseRest(path, { method = 'GET', query, body, headers } = {}) {
  assertEnv();
  const url = buildUrl(path, query);
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Supabase request failed: ${res.status}`);
  }
  return data;
}

export function parseYearMonth(value) {
  const m = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function mapCaseTypeToEnum(value) {
  if (value === '新規案件') return 'new_case';
  if (value === '再稼働案件') return 'rework_case';
  if (value === '見込みになっていない提案中の方') return 'proposal_only';
  if (['new_case', 'rework_case', 'proposal_only', 'other'].includes(value)) return value;
  return 'other';
}

export async function ensureBranch(branchName) {
  const name = (branchName || '').trim();
  if (!name) throw new Error('branch is required');

  const existing = await supabaseRest('branches', {
    query: { select: 'id,name', name: `eq.${name}`, limit: '1' },
  });
  if (existing?.[0]?.id) return existing[0];

  const maxRows = await supabaseRest('branches', {
    query: { select: 'sort_order', order: 'sort_order.desc', limit: '1' },
  });
  const sortOrder = (maxRows?.[0]?.sort_order ?? -1) + 1;

  const inserted = await supabaseRest('branches', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: [{ name, sort_order: sortOrder, is_active: true }],
  });
  return inserted[0];
}

export async function findManagerId(managerName) {
  const name = (managerName || '').trim();
  if (!name) return null;
  const rows = await supabaseRest('managers', {
    query: { select: 'id', name: `eq.${name}`, limit: '1' },
  });
  return rows?.[0]?.id ?? null;
}