import { useState, useEffect } from 'react';
import { supabase } from './supabase.js';
import { fetchProfile } from './auth.js';
import { logAction } from './audit.js';

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);

        if (u) {
          const { data } = await fetchProfile(u.id);
          if (mounted) setProfile(data || null);
          if (event === 'SIGNED_IN') {
            logAction({ userId: u.id, actionType: 'user_logged_in', description: `${u.email} logged in` });
          }
        } else {
          setProfile(null);
        }

        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
