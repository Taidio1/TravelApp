import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtime<T extends { id: string }>(table: string) {
  const [data, setData] = useState<T[]>([]);

  useEffect(() => {
    // Initial fetch
    const fetchData = async () => {
      const { data: initialData } = await supabase
        .from(table)
        .select('*');
      
      if (initialData) setData(initialData as T[]);
    };

    fetchData();

    // Subscribe to changes
    const channel = supabase
      .channel(`public:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setData((prev) => [...prev, payload.new as T]);
        } else if (payload.eventType === 'UPDATE') {
          setData((prev) => prev.map((item) => (item.id === payload.new.id ? (payload.new as T) : item)));
        } else if (payload.eventType === 'DELETE') {
          setData((prev) => prev.filter((item) => item.id === payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table]);

  return data;
}
