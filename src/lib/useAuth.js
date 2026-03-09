/**
 * useAuth — manages Supabase session state and user profile.
 * Provides the single source of truth for "who is logged in".
 */

import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { fetchProfile } from './auth.js';
import { logAction } from './audit.js';

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId) {
    const { data } = await fetchProfile(userId);
    setProfile(data || null);
  }

  useEffect(() => {
    let mounted = true;

    // Resolve existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u.id).finally(() => { if (mounted) setLoading(false); });
      } else {
        setLoading(false);
      }
    });

    // Subscribe to future auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          await loadProfile(u.id);
          if (event === 'SIGNED_IN') {
            logAction({ userId: u.id, actionType: 'user_logged_in', description: `${u.email} logged in` });
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
