import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      setCheckedUserId(null);
      return;
    }

    const currentUserId = user.id;
    setLoading(true);

    const checkAdmin = async () => {
      const { data, error } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', currentUserId)
        .eq('role', 'admin')
        .maybeSingle();

      if (!isMounted) return;
      setIsAdmin(!error && !!data);
      setCheckedUserId(currentUserId);
      setLoading(false);
    };

    checkAdmin();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const checkingCurrentUser = !!user && (loading || checkedUserId !== user.id);

  return { isAdmin, loading: checkingCurrentUser };
}
