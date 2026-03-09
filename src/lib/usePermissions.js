/**
 * usePermissions — manages the full access-request / permission lifecycle.
 *
 * Vocabulary:
 *   from_user  = person who wants access (the "requester" / future grantee)
 *   to_user    = person who owns the data (the "grantor")
 *
 * After to_user accepts, a row in `permissions` is upserted:
 *   granter_id = to_user   (data owner)
 *   grantee_id = from_user (person given access)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase.js';
import { fetchProfileByEmail, fetchProfilesByIds } from './auth.js';
import { logAction } from './audit.js';

export function usePermissions(currentUser, currentProfile) {
  const [incomingRequests,   setIncomingRequests]   = useState([]); // requests to me
  const [outgoingRequests,   setOutgoingRequests]   = useState([]); // requests from me
  const [myGrantees,         setMyGrantees]         = useState([]); // users I've given access to
  const [grantedToMe,        setGrantedToMe]        = useState([]); // users who gave me access
  const [profilesMap,        setProfilesMap]        = useState({}); // id → profile cache
  const [loading,            setLoading]            = useState(true);

  const uid = currentUser?.id;

  // ── load all permission data ────────────────────────────────────────────────
  const reload = useCallback(async () => {
    if (!uid) return;

    const [reqIn, reqOut, permOut, permIn] = await Promise.all([
      supabase.from('access_requests').select('*').eq('to_user',   uid).order('created_at', { ascending: false }),
      supabase.from('access_requests').select('*').eq('from_user', uid).order('created_at', { ascending: false }),
      supabase.from('permissions').select('*').eq('granter_id', uid),
      supabase.from('permissions').select('*').eq('grantee_id', uid),
    ]);

    setIncomingRequests(reqIn.data   || []);
    setOutgoingRequests(reqOut.data  || []);
    setMyGrantees(permOut.data       || []);
    setGrantedToMe(permIn.data       || []);

    // Build profiles map for all referenced users
    const allIds = new Set([
      ...(reqIn.data  || []).flatMap(r => [r.from_user]),
      ...(reqOut.data || []).flatMap(r => [r.to_user]),
      ...(permOut.data|| []).flatMap(p => [p.grantee_id]),
      ...(permIn.data || []).flatMap(p => [p.granter_id]),
    ]);
    if (allIds.size > 0) {
      const { data: profiles } = await fetchProfilesByIds([...allIds]);
      const map = {};
      (profiles || []).forEach(p => { map[p.id] = p; });
      setProfilesMap(map);
    }

    setLoading(false);
  }, [uid]);

  useEffect(() => { reload(); }, [reload]);

  // ── real-time: watch requests + permissions ─────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    const ch = supabase
      .channel(`permissions-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permissions' },     reload)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [uid, reload]);

  // ── send access request ─────────────────────────────────────────────────────
  const sendRequest = useCallback(async (toEmail, accessType) => {
    const { data: target, error: lookupErr } = await fetchProfileByEmail(toEmail);
    if (lookupErr || !target) return { error: 'User not found with that email address.' };
    if (target.id === uid)    return { error: 'You cannot request access to your own data.' };

    // Check for duplicate pending request
    const { data: existing } = await supabase
      .from('access_requests')
      .select('id, status')
      .eq('from_user', uid)
      .eq('to_user',   target.id)
      .eq('status',    'pending')
      .maybeSingle();

    if (existing) return { error: 'You already have a pending request to this user.' };

    // Check if permission is already granted for this type
    const { data: perm } = await supabase
      .from('permissions')
      .select('can_view, can_edit')
      .eq('granter_id', target.id)
      .eq('grantee_id', uid)
      .maybeSingle();

    if (perm) {
      if (accessType === 'view' && perm.can_view) return { error: 'You already have View access.' };
      if (accessType === 'edit' && perm.can_edit) return { error: 'You already have Edit access.' };
      if (accessType === 'both' && perm.can_view && perm.can_edit) return { error: 'You already have full access.' };
    }

    const { error } = await supabase
      .from('access_requests')
      .insert({ from_user: uid, to_user: target.id, access_type: accessType });

    if (error) return { error: error.message };

    logAction({
      userId: uid, ownerId: target.id,
      actionType: 'access_request_sent',
      description: `${currentProfile?.display_name || 'A user'} requested ${accessType} access`,
      metadata: { to_email: toEmail, access_type: accessType },
    });

    return {};
  }, [uid, currentProfile]);

  // ── accept request ──────────────────────────────────────────────────────────
  const acceptRequest = useCallback(async (requestId) => {
    const req = incomingRequests.find(r => r.id === requestId);
    if (!req) return { error: 'Request not found.' };

    // 1. Update request status
    const { error: updErr } = await supabase
      .from('access_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId);
    if (updErr) return { error: updErr.message };

    // 2. Upsert permissions (additive)
    const canView = req.access_type === 'view' || req.access_type === 'both';
    const canEdit = req.access_type === 'edit' || req.access_type === 'both';

    const { data: existing } = await supabase
      .from('permissions')
      .select('*')
      .eq('granter_id', uid)
      .eq('grantee_id', req.from_user)
      .maybeSingle();

    const newView = canView || (existing?.can_view ?? false);
    const newEdit = canEdit || (existing?.can_edit ?? false);

    const { error: permErr } = await supabase
      .from('permissions')
      .upsert({
        granter_id: uid,
        grantee_id: req.from_user,
        can_view:   newView,
        can_edit:   newEdit,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'granter_id,grantee_id' });

    if (permErr) return { error: permErr.message };

    const requesterName = profilesMap[req.from_user]?.display_name || 'User';
    logAction({
      userId: uid, ownerId: uid,
      actionType: 'access_request_accepted',
      description: `Accepted ${req.access_type} access request from ${requesterName}`,
      metadata: { from_user: req.from_user, access_type: req.access_type },
    });

    return {};
  }, [uid, incomingRequests, profilesMap]);

  // ── reject request ──────────────────────────────────────────────────────────
  const rejectRequest = useCallback(async (requestId) => {
    const req = incomingRequests.find(r => r.id === requestId);
    const { error } = await supabase
      .from('access_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) return { error: error.message };

    const requesterName = profilesMap[req?.from_user]?.display_name || 'User';
    logAction({
      userId: uid, ownerId: uid,
      actionType: 'access_request_rejected',
      description: `Rejected access request from ${requesterName}`,
    });

    return {};
  }, [uid, incomingRequests, profilesMap]);

  // ── revoke access ───────────────────────────────────────────────────────────
  const revokeAccess = useCallback(async (granteeId) => {
    const { error } = await supabase
      .from('permissions')
      .delete()
      .eq('granter_id', uid)
      .eq('grantee_id', granteeId);

    if (error) return { error: error.message };

    logAction({
      userId: uid, ownerId: uid,
      actionType: 'permission_revoked',
      description: `Revoked access for ${profilesMap[granteeId]?.display_name || 'user'}`,
    });

    return {};
  }, [uid, profilesMap]);

  // ── helper: check specific permission ──────────────────────────────────────
  function hasPermission(granterId, type) {
    const perm = grantedToMe.find(p => p.granter_id === granterId);
    if (!perm) return false;
    if (type === 'view') return perm.can_view;
    if (type === 'edit') return perm.can_edit;
    return false;
  }

  return {
    loading,
    incomingRequests,
    outgoingRequests,
    myGrantees,
    grantedToMe,
    profilesMap,
    sendRequest,
    acceptRequest,
    rejectRequest,
    revokeAccess,
    hasPermission,
    reload,
  };
}
