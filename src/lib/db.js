/**
 * db.js — All Supabase CRUD, user-scoped + version-tracked + audit-logged.
 */
import { supabase } from './supabase.js';
import { logAction } from './audit.js';

const ok  = data  => ({ data, error: null });
const err = error => ({ data: null, error });
async function run(p) { const { data, error } = await p; return error ? err(error) : ok(data); }

// ── guests ─────────────────────────────────────────────────────────────────────
export async function fetchGuests(userId) {
  return run(supabase.from('guests').select('*').eq('user_id', userId).order('created_at', { ascending: true }));
}
export async function insertGuest(userId, guest, actorId) {
  const { id: _i, ...payload } = guest;
  const { data, error } = await supabase.from('guests').insert({
    ...payload, user_id: userId, last_edited_by: actorId, last_edited_at: new Date().toISOString(),
  }).select().single();
  if (error) return err(error);
  logAction({ userId: actorId, ownerId: userId, actionType: 'guest_created', entityType: 'guest',
    entityId: data.id, description: `Added guest "${data.name}"`, metadata: { name: data.name, side: data.side } });
  return ok(data);
}
export async function updateGuest(id, changes, actorId, expectedVersion) {
  let q = supabase.from('guests').update({
    ...changes, version: supabase.rpc ? (expectedVersion||1)+1 : (expectedVersion||1)+1,
    last_edited_by: actorId, last_edited_at: new Date().toISOString(),
  }).eq('id', id);
  if (expectedVersion) q = q.eq('version', expectedVersion);
  const { data, error } = await q.select().single();
  if (error) return err(error);
  if (!data) return err({ message: 'Version conflict — record was modified by someone else. Refresh and retry.' });
  logAction({ userId: actorId, ownerId: data.user_id, actionType: 'guest_updated', entityType: 'guest',
    entityId: id, description: `Updated guest "${data.name}"`, metadata: changes });
  return ok(data);
}
export async function deleteGuest(id, actorId, ownerId) {
  const { error } = await supabase.from('guests').delete().eq('id', id);
  if (error) return err(error);
  logAction({ userId: actorId, ownerId, actionType: 'guest_deleted', entityType: 'guest', entityId: id, description: 'Deleted guest' });
  return ok(null);
}
export async function deleteGuestsByIds(ids, actorId, ownerId) {
  if (!ids.length) return ok([]);
  const { error } = await supabase.from('guests').delete().in('id', ids);
  if (error) return err(error);
  logAction({ userId: actorId, ownerId, actionType: 'guest_deleted', description: `Deleted ${ids.length} guests` });
  return ok(null);
}

// ── rooms ──────────────────────────────────────────────────────────────────────
export async function fetchRooms(userId) {
  return run(supabase.from('rooms').select('*').eq('user_id', userId).order('created_at', { ascending: true }));
}
export async function insertRoom(userId, room, actorId) {
  const { id: _i, ...payload } = room;
  const { data, error } = await supabase.from('rooms').insert({
    ...payload, user_id: userId, last_edited_by: actorId, last_edited_at: new Date().toISOString(),
  }).select().single();
  if (error) return err(error);
  logAction({ userId: actorId, ownerId: userId, actionType: 'room_created', entityType: 'room',
    entityId: data.id, description: `Added room "${data.number}"` });
  return ok(data);
}
export async function updateRoom(id, changes, actorId, expectedVersion) {
  let q = supabase.from('rooms').update({
    ...changes, version: (expectedVersion||1)+1, last_edited_by: actorId, last_edited_at: new Date().toISOString(),
  }).eq('id', id);
  if (expectedVersion) q = q.eq('version', expectedVersion);
  const { data, error } = await q.select().single();
  if (error) return err(error);
  if (!data) return err({ message: 'Version conflict — record was modified by someone else. Refresh and retry.' });
  logAction({ userId: actorId, ownerId: data.user_id, actionType: 'room_updated', entityType: 'room',
    entityId: id, description: `Updated room "${data.number}"`, metadata: changes });
  return ok(data);
}
export async function deleteRoom(id, actorId, ownerId) {
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) return err(error);
  logAction({ userId: actorId, ownerId, actionType: 'room_deleted', entityType: 'room', entityId: id, description: 'Deleted room' });
  return ok(null);
}

// ── pairs ──────────────────────────────────────────────────────────────────────
export async function fetchPairs(userId) {
  return run(supabase.from('pairs').select('*').eq('user_id', userId).order('created_at', { ascending: true }));
}
export async function insertPair(userId, pair, actorId) {
  const { id: _i, ...payload } = pair;
  const { data, error } = await supabase.from('pairs').insert({ ...payload, user_id: userId }).select().single();
  if (error) return err(error);
  logAction({ userId: actorId, ownerId: userId, actionType: 'pair_created', entityType: 'pair',
    entityId: data.id, description: 'Created preferred pair' });
  return ok(data);
}
export async function deletePair(id, actorId, ownerId) {
  const { error } = await supabase.from('pairs').delete().eq('id', id);
  if (error) return err(error);
  logAction({ userId: actorId, ownerId, actionType: 'pair_deleted', entityType: 'pair', entityId: id, description: 'Removed preferred pair' });
  return ok(null);
}
export async function deletePairsByGuestIds(guestIds) {
  if (!guestIds.length) return ok([]);
  return run(supabase.from('pairs').delete().or(guestIds.map(id => `a.eq.${id},b.eq.${id}`).join(',')));
}

// ── app_state ──────────────────────────────────────────────────────────────────
export async function fetchAppState(userId) {
  const { data, error } = await supabase.from('app_state').select('*').eq('user_id', userId).maybeSingle();
  return error ? err(error) : ok(data || null);
}
export async function upsertAppState(userId, payload) {
  return run(supabase.from('app_state')
    .upsert({ user_id: userId, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select().single());
}

// ── audit logs ─────────────────────────────────────────────────────────────────
export async function fetchAuditLogs(userId, limit = 100) {
  return run(
    supabase.from('audit_logs')
      .select('*, actor:user_id(id,display_name,email)')
      .or(`user_id.eq.${userId},owner_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

// ── bulk import ────────────────────────────────────────────────────────────────
export async function importAll({ userId, guests, rooms, pairs, tab, actorId }) {
  for (const table of ['pairs','guests','rooms','app_state']) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) return err(`Failed to clear ${table}: ${error.message}`);
  }
  const ts = new Date().toISOString();
  if (guests.length) {
    const { error } = await supabase.from('guests').insert(
      guests.map(({ id: _i, ...g }) => ({ ...g, user_id: userId, last_edited_by: actorId, last_edited_at: ts, version: 1 }))
    );
    if (error) return err(`Failed to insert guests: ${error.message}`);
  }
  const { data: freshGuests, error: fgErr } = await supabase.from('guests').select('*').eq('user_id', userId).order('created_at', { ascending: true });
  if (fgErr) return err(`Failed to re-fetch guests: ${fgErr.message}`);

  if (rooms.length) {
    const { error } = await supabase.from('rooms').insert(
      rooms.map(({ id: _i, ...r }) => ({ ...r, user_id: userId, last_edited_by: actorId, last_edited_at: ts, version: 1 }))
    );
    if (error) return err(`Failed to insert rooms: ${error.message}`);
  }
  const { data: freshRooms, error: frErr } = await supabase.from('rooms').select('*').eq('user_id', userId).order('created_at', { ascending: true });
  if (frErr) return err(`Failed to re-fetch rooms: ${frErr.message}`);

  const oldToNew = {};
  (guests || []).forEach((g, i) => { if (freshGuests[i]) oldToNew[g.id] = freshGuests[i].id; });

  if (pairs.length) {
    const { error } = await supabase.from('pairs').insert(
      pairs.map(p => ({ user_id: userId, a: oldToNew[p.a]||p.a, b: oldToNew[p.b]||p.b }))
    );
    if (error) return err(`Failed to insert pairs: ${error.message}`);
  }
  await supabase.from('app_state').upsert(
    { user_id: userId, active_tab: tab||'guests', result: null, updated_at: ts }, { onConflict: 'user_id' }
  );
  logAction({ userId: actorId, ownerId: userId, actionType: 'data_imported',
    description: `Imported ${guests.length} guests, ${rooms.length} rooms` });
  return ok({ guests: freshGuests, rooms: freshRooms });
}
