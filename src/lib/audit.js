/**
 * audit.js — Append-only audit log helper.
 *
 * Action types:
 *   user_registered, user_logged_in, user_logged_out
 *   access_request_sent, access_request_accepted, access_request_rejected
 *   permission_revoked
 *   guest_created, guest_updated, guest_deleted
 *   room_created, room_updated, room_deleted
 *   pair_created, pair_deleted
 *   allocation_run
 *   shared_data_accessed
 *   data_imported, data_exported
 */

import { supabase } from './supabase.js';

/**
 * @param {object} entry
 * @param {string} entry.userId       - Who performed the action (auth.uid())
 * @param {string} entry.actionType   - Action identifier (see list above)
 * @param {string} [entry.entityType] - 'guest' | 'room' | 'pair' | 'permission' | null
 * @param {string} [entry.entityId]   - UUID of affected record
 * @param {string} [entry.ownerId]    - Owner of affected data (may differ from userId)
 * @param {string} entry.description  - Human-readable description
 * @param {object} [entry.metadata]   - Extra JSONB context
 */
export async function logAction({
  userId,
  actionType,
  entityType = null,
  entityId   = null,
  ownerId    = null,
  description,
  metadata   = null,
}) {
  // Fire-and-forget — audit failures must never block main operations
  supabase
    .from('audit_logs')
    .insert({
      user_id:     userId,
      action_type: actionType,
      entity_type: entityType,
      entity_id:   entityId   || undefined,
      owner_id:    ownerId    || undefined,
      description,
      metadata:    metadata   || undefined,
    })
    .then(({ error }) => {
      if (error) console.warn('[audit] log failed:', error.message);
    });
}
