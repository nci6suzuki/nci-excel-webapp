import { supabaseRest } from './supabase.js';

export async function replaceTableRows(table, rows) {
  const baseDelete = await supabaseRest(`${table}?id=not.is.null`, { method: 'DELETE' });
  if (baseDelete === null || !rows.length) return;
  await supabaseRest(table, { method: 'POST', body: rows });
}

export async function upsertRows(table, rows, onConflict) {
  if (!rows.length) return;
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
  const res = await supabaseRest(`${table}${query}`, {
    method: 'POST',
    body: rows,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  });
  if (res === null) return;
}

export async function updateRow(table, match, patch) {
  const entries = Object.entries(match);
  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=eq.${encodeURIComponent(String(value))}`)
    .join('&');
  await supabaseRest(`${table}?${query}`, {
    method: 'PATCH',
    body: patch,
  });
}