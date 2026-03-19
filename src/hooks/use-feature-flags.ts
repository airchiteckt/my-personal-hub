import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/hooks/use-admin';

export interface FeatureFlag {
  id: string;
  key: string;
  label: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
}

export function useFeatureFlags() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    const { data, error } = await supabase
      .from('feature_flags' as any)
      .select('*')
      .order('category')
      .order('label');

    if (!error && data) {
      setFlags(data as unknown as FeatureFlag[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) {
      setFlags([]);
      setLoading(false);
      return;
    }
    fetchFlags();
  }, [user]);

  const isFeatureEnabled = (key: string): boolean => {
    // Admins always see everything
    if (isAdmin) return true;
    const flag = flags.find(f => f.key === key);
    // If flag not found, default to visible
    return flag ? flag.is_enabled : true;
  };

  const toggleFlag = async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from('feature_flags' as any)
      .update({ is_enabled: enabled } as any)
      .eq('id', id);

    if (!error) {
      setFlags(prev => prev.map(f => f.id === id ? { ...f, is_enabled: enabled } : f));
    }
    return { error: error?.message ?? null };
  };

  return { flags, loading, isFeatureEnabled, toggleFlag, refetch: fetchFlags };
}
