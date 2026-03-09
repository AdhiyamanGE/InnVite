/**
 * useLocks — manages edit locks for a given owner's records.
 *
 * Mechanism:
 *   1. Pessimistic UI lock: stored in `edit_locks` table with 45s TTL.
 *   2. Heartbeat every 20s refreshes expires_at while editing.
 *   3. Owner can always force-release any lock on their own data.
 *   4. Optimistic version check in db.js is the final safety net.
 *
 * Lock key format: `${recordType}:${recordId}`
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase.js';

const LOCK_TTL_MS  = 45_000; // 45 seconds
const HEARTBEAT_MS = 20_000; // 20 seconds

function now() { return new Date().toISOString(); }
function expiresAt() {
  return new Date(Date.now() + LOCK_TTL_MS).toISOString();
}
function isExpired(lock) {
  return new Date(lock.expires_at) <= new Date();
}

export function useLocks({ ownerId, currentUserId, currentUserName }) {
  // Map: 'record_type:record_id' → lock object
  const [locks, setLocks] = useState({});
  // Track locks held by current user (for heartbeat)
  const myLocksRef = useRef(new Set());

  // ── load locks on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!ownerId) return;

    async function load() {
      const { data } = await supabase
        .from('edit_locks')
        .select('*')
        .eq('data_owner_id', ownerId)
        .gt('expires_at', now());

      if (data) {
        const map = {};
        data.forEach(l => { map[`${l.record_type}:${l.record_id}`] = l; });
        setLocks(map);
        // Track my own locks
        data
          .filter(l => l.locked_by === currentUserId)
          .forEach(l => myLocksRef.current.add(`${l.record_type}:${l.record_id}`));
      }
    }

    load();
  }, [ownerId, currentUserId]);

  // ── real-time: watch lock changes ───────────────────────────────────────────
  useEffect(() => {
    if (!ownerId) return;

    const ch = supabase
      .channel(`locks-${ownerId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'edit_locks' },
        payload => {
          if (payload.new.data_owner_id !== ownerId) return;
          const key = `${payload.new.record_type}:${payload.new.record_id}`;
          setLocks(prev => ({ ...prev, [key]: payload.new }));
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'edit_locks' },
        payload => {
          if (payload.new.data_owner_id !== ownerId) return;
          const key = `${payload.new.record_type}:${payload.new.record_id}`;
          setLocks(prev => ({ ...prev, [key]: payload.new }));
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'edit_locks' },
        payload => {
          const key = `${payload.old.record_type}:${payload.old.record_id}`;
          setLocks(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          myLocksRef.current.delete(key);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [ownerId]);

  // ── heartbeat: refresh my active locks ─────────────────────────────────────
  useEffect(() => {
    if (!ownerId || !currentUserId) return;

    const interval = setInterval(async () => {
      for (const key of myLocksRef.current) {
        const [recordType, recordId] = key.split(':');
        await supabase
          .from('edit_locks')
          .update({ expires_at: expiresAt() })
          .eq('record_type', recordType)
          .eq('record_id',   recordId)
          .eq('locked_by',   currentUserId);
      }
    }, HEARTBEAT_MS);

    return () => clearInterval(interval);
  }, [ownerId, currentUserId]);

  // ── acquireLock ─────────────────────────────────────────────────────────────
  const acquireLock = useCallback(async (recordType, recordId) => {
    const key      = `${recordType}:${recordId}`;
    const existing = locks[key];

    // If an unexpired lock exists from another user, refuse
    if (existing && !isExpired(existing) && existing.locked_by !== currentUserId) {
      // Data owner always has priority — owner ignores grantee locks
      if (ownerId !== currentUserId) {
        return {
          success: false,
          lockedByName: existing.locked_by_name || 'Another user',
        };
      }
      // Owner wants to edit — force-release the grantee's lock first
      await supabase.from('edit_locks').delete()
        .eq('record_type', recordType).eq('record_id', recordId);
    }

    // Upsert lock
    const { error } = await supabase
      .from('edit_locks')
      .upsert({
        record_type:    recordType,
        record_id:      recordId,
        data_owner_id:  ownerId,
        locked_by:      currentUserId,
        locked_by_name: currentUserName || 'Unknown',
        expires_at:     expiresAt(),
      }, { onConflict: 'record_type,record_id' });

    if (error) {
      // Upsert conflict means someone grabbed it milliseconds before us
      return { success: false, lockedByName: 'Another user' };
    }

    const lockData = {
      record_type:    recordType,
      record_id:      recordId,
      data_owner_id:  ownerId,
      locked_by:      currentUserId,
      locked_by_name: currentUserName || 'Unknown',
      expires_at:     expiresAt(),
    };
    setLocks(prev => ({ ...prev, [key]: lockData }));
    myLocksRef.current.add(key);
    return { success: true };
  }, [locks, ownerId, currentUserId, currentUserName]);

  // ── releaseLock ─────────────────────────────────────────────────────────────
  const releaseLock = useCallback(async (recordType, recordId) => {
    const key = `${recordType}:${recordId}`;
    myLocksRef.current.delete(key);
    setLocks(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    await supabase
      .from('edit_locks')
      .delete()
      .eq('record_type', recordType)
      .eq('record_id',   recordId)
      .eq('locked_by',   currentUserId);
  }, [currentUserId]);

  // ── releaseAllMyLocks (on unmount / navigation away) ───────────────────────
  const releaseAllMyLocks = useCallback(async () => {
    const keys = [...myLocksRef.current];
    myLocksRef.current.clear();
    setLocks(prev => {
      const next = { ...prev };
      keys.forEach(k => delete next[k]);
      return next;
    });
    if (keys.length > 0) {
      await supabase
        .from('edit_locks')
        .delete()
        .eq('data_owner_id', ownerId)
        .eq('locked_by',     currentUserId);
    }
  }, [ownerId, currentUserId]);

  // ── helpers ─────────────────────────────────────────────────────────────────
  function getLockInfo(recordType, recordId) {
    const lock = locks[`${recordType}:${recordId}`];
    if (!lock || isExpired(lock)) return null;
    return lock;
  }

  function isLockedByOther(recordType, recordId) {
    const lock = getLockInfo(recordType, recordId);
    if (!lock) return false;
    // Owner always overrides any lock from grantees
    if (ownerId === currentUserId) return false;
    return lock.locked_by !== currentUserId;
  }

  function isLockedByMe(recordType, recordId) {
    const lock = getLockInfo(recordType, recordId);
    return lock?.locked_by === currentUserId;
  }

  return {
    locks,
    acquireLock,
    releaseLock,
    releaseAllMyLocks,
    getLockInfo,
    isLockedByOther,
    isLockedByMe,
  };
}
