/**
 * useAppData — scoped to a specific userId (owner of the data being viewed).
 * Works for both "my own data" and "someone else's data I have access to".
 * actorId = who is performing actions (may differ from userId when editing shared data).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  fetchGuests, fetchRooms, fetchPairs, fetchAppState,
  insertGuest, updateGuest, deleteGuest, deleteGuestsByIds,
  insertRoom, updateRoom, deleteRoom,
  insertPair, deletePair, deletePairsByGuestIds,
  upsertAppState, importAll, fetchAuditLogs,
} from './db.js';
import { supabase } from './supabase.js';
import { allocate } from './allocate.js';
import { logAction } from './audit.js';

const INITIAL = { guests:[], rooms:[], pairs:[], result:null, tab:'guests', loading:true, error:null };

export function useAppData({ userId, actorId, canEdit = true }) {
  const [state, setState] = useState(INITIAL);
  const set    = useCallback(patch => setState(s => ({ ...s, ...patch })), []);
  const setErr = useCallback(msg  => set({ error: msg, loading: false }), [set]);

  // ── initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      const [gRes, rRes, pRes, asRes] = await Promise.all([
        fetchGuests(userId), fetchRooms(userId), fetchPairs(userId), fetchAppState(userId),
      ]);
      if (cancelled) return;
      const firstErr = [gRes, rRes, pRes, asRes].find(r => r.error);
      if (firstErr) { setErr('Failed to load data: ' + (firstErr.error?.message || firstErr.error)); return; }
      set({ guests: gRes.data||[], rooms: rRes.data||[], pairs: pRes.data||[],
            result: asRes.data?.result||null, tab: asRes.data?.active_tab||'guests',
            loading: false, error: null });
    }
    load();
    return () => { cancelled = true; };
  }, [userId, set, setErr]);

  // ── real-time subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`data-${userId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'guests',   filter:`user_id=eq.${userId}` }, payload => {
        setState(s => {
          if (payload.eventType==='INSERT') return {...s, guests:[...s.guests, payload.new]};
          if (payload.eventType==='UPDATE') return {...s, guests: s.guests.map(g=>g.id===payload.new.id?payload.new:g)};
          if (payload.eventType==='DELETE') return {...s, guests: s.guests.filter(g=>g.id!==payload.old.id)};
          return s;
        });
      })
      .on('postgres_changes', { event:'*', schema:'public', table:'rooms',    filter:`user_id=eq.${userId}` }, payload => {
        setState(s => {
          if (payload.eventType==='INSERT') return {...s, rooms:[...s.rooms, payload.new]};
          if (payload.eventType==='UPDATE') return {...s, rooms: s.rooms.map(r=>r.id===payload.new.id?payload.new:r)};
          if (payload.eventType==='DELETE') return {...s, rooms: s.rooms.filter(r=>r.id!==payload.old.id)};
          return s;
        });
      })
      .on('postgres_changes', { event:'*', schema:'public', table:'pairs',    filter:`user_id=eq.${userId}` }, payload => {
        setState(s => {
          if (payload.eventType==='INSERT') return {...s, pairs:[...s.pairs, payload.new]};
          if (payload.eventType==='DELETE') return {...s, pairs: s.pairs.filter(p=>p.id!==payload.old.id)};
          return s;
        });
      })
      .on('postgres_changes', { event:'*', schema:'public', table:'app_state', filter:`user_id=eq.${userId}` }, payload => {
        if (payload.new?.user_id===userId) {
          setState(s => ({...s, result: payload.new.result||null, tab: payload.new.active_tab||s.tab}));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  // ── tab ─────────────────────────────────────────────────────────────────────
  const setTab = useCallback(async tab => {
    set({ tab });
    if (canEdit) await upsertAppState(userId, { active_tab: tab });
  }, [userId, canEdit, set]);

  // ── guests ──────────────────────────────────────────────────────────────────
  const addGuest = useCallback(async guestData => {
    const { data, error } = await insertGuest(userId, guestData, actorId);
    if (error) return { error };
    setState(s => ({ ...s, guests: [...s.guests, data] }));
    return { data };
  }, [userId, actorId]);

  const editGuest = useCallback(async (id, changes) => {
    const current = state.guests.find(g => g.id === id);
    const { data, error } = await updateGuest(id, changes, actorId, current?.version);
    if (error) return { error };
    setState(s => ({ ...s, guests: s.guests.map(g => g.id===id ? data : g) }));
    return { data };
  }, [state.guests, actorId]);

  const removeGuest = useCallback(async id => {
    const { error } = await deleteGuest(id, actorId, userId);
    if (error) return { error };
    await deletePairsByGuestIds([id]);
    setState(s => ({ ...s, guests: s.guests.filter(g=>g.id!==id), pairs: s.pairs.filter(p=>p.a!==id&&p.b!==id) }));
    return {};
  }, [actorId, userId]);

  const clearGuestsBySide = useCallback(async sideId => {
    const ids = state.guests.filter(g=>g.side===sideId).map(g=>g.id);
    if (!ids.length) return {};
    await deletePairsByGuestIds(ids);
    const { error } = await deleteGuestsByIds(ids, actorId, userId);
    if (error) return { error };
    setState(s => ({ ...s, guests: s.guests.filter(g=>g.side!==sideId), pairs: s.pairs.filter(p=>!ids.includes(p.a)&&!ids.includes(p.b)) }));
    return {};
  }, [state.guests, actorId, userId]);

  const clearAllGuests = useCallback(async () => {
    const ids = state.guests.map(g=>g.id);
    if (!ids.length) return {};
    await deletePairsByGuestIds(ids);
    const { error } = await deleteGuestsByIds(ids, actorId, userId);
    if (error) return { error };
    setState(s => ({ ...s, guests:[], pairs:[] }));
    return {};
  }, [state.guests, actorId, userId]);

  const dropPairsForGuest = useCallback(async guestId => {
    await deletePairsByGuestIds([guestId]);
    setState(s => ({ ...s, pairs: s.pairs.filter(p=>p.a!==guestId&&p.b!==guestId) }));
  }, []);

  // ── rooms ───────────────────────────────────────────────────────────────────
  const addRoom = useCallback(async roomData => {
    const { data, error } = await insertRoom(userId, roomData, actorId);
    if (error) return { error };
    setState(s => ({ ...s, rooms: [...s.rooms, data] }));
    return { data };
  }, [userId, actorId]);

  const editRoom = useCallback(async (id, changes) => {
    const current = state.rooms.find(r=>r.id===id);
    const { data, error } = await updateRoom(id, changes, actorId, current?.version);
    if (error) return { error };
    setState(s => ({ ...s, rooms: s.rooms.map(r=>r.id===id?data:r) }));
    return { data };
  }, [state.rooms, actorId]);

  const removeRoom = useCallback(async id => {
    const { error } = await deleteRoom(id, actorId, userId);
    if (error) return { error };
    setState(s => ({ ...s, rooms: s.rooms.filter(r=>r.id!==id) }));
    return {};
  }, [actorId, userId]);

  const clearAllRooms = useCallback(async () => {
    const { error } = await supabase.from('rooms').delete().eq('user_id', userId);
    if (error) return { error };
    setState(s => ({ ...s, rooms:[] }));
    return {};
  }, [userId]);

  // ── pairs ───────────────────────────────────────────────────────────────────
  const addPair = useCallback(async (a, b) => {
    const { data, error } = await insertPair(userId, { a, b }, actorId);
    if (error) return { error };
    setState(s => ({ ...s, pairs: [...s.pairs, data] }));
    return { data };
  }, [userId, actorId]);

  const removePair = useCallback(async id => {
    const { error } = await deletePair(id, actorId, userId);
    if (error) return { error };
    setState(s => ({ ...s, pairs: s.pairs.filter(p=>p.id!==id) }));
    return {};
  }, [actorId, userId]);

  // ── allocation ──────────────────────────────────────────────────────────────
  const runAllocation = useCallback(async () => {
    const { guests, rooms, pairs } = state;
    const newResult = allocate(guests, rooms, pairs);
    setState(s => ({ ...s, result: newResult, tab: 'allocate' }));
    await upsertAppState(userId, { active_tab: 'allocate', result: newResult });
    logAction({ userId: actorId, ownerId: userId, actionType: 'allocation_run',
      description: `Ran allocation: ${newResult.placed.length} rooms used, ${newResult.unplaced.length} unplaced` });
    return newResult;
  }, [state, userId, actorId]);

  const updateResult = useCallback(async newResult => {
    setState(s => ({ ...s, result: newResult }));
    await upsertAppState(userId, { active_tab: state.tab, result: newResult });
  }, [userId, state.tab]);

  // ── export / import ──────────────────────────────────────────────────────────
  const exportBackup = useCallback(() => {
    const payload = { guests: state.guests, rooms: state.rooms, pairs: state.pairs, result: state.result, tab: state.tab };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'innvite-backup.json'; a.click();
    URL.revokeObjectURL(url);
    logAction({ userId: actorId, ownerId: userId, actionType: 'data_exported', description: 'Exported backup JSON' });
  }, [state, userId, actorId]);

  const importBackup = useCallback(async (parsed, onConfirm) => {
    const { guests: g=[], rooms: r=[], pairs: p=[], tab: t } = parsed;
    if (state.guests.length || state.rooms.length) {
      const confirmed = await onConfirm(`Importing will replace all current data (${state.guests.length} guests, ${state.rooms.length} rooms).\n\nProceed?`);
      if (!confirmed) return { cancelled: true };
    }
    set({ loading: true });
    const { data, error } = await importAll({ userId, actorId, guests: g, rooms: r, pairs: p, tab: t });
    if (error) { set({ loading: false, error: String(error) }); return { error }; }
    const { data: freshPairs } = await fetchPairs(userId);
    setState(s => ({ ...s, guests: data.guests||[], rooms: data.rooms||[], pairs: freshPairs||[],
                           result: null, tab: t||'guests', loading: false, error: null }));
    return {};
  }, [userId, actorId, state.guests.length, state.rooms.length, set]);

  return {
    guests: state.guests, rooms: state.rooms, pairs: state.pairs,
    result: state.result, tab: state.tab, loading: state.loading, error: state.error,
    setTab,
    addGuest, editGuest, removeGuest, clearGuestsBySide, clearAllGuests, dropPairsForGuest,
    addRoom, editRoom, removeRoom, clearAllRooms,
    addPair, removePair,
    runAllocation, updateResult,
    exportBackup, importBackup,
  };
}
