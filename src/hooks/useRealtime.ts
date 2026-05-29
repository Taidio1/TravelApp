import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface RealtimeOptions {
  /** Restrict the initial fetch + realtime stream to rows where column = value. */
  filter?: { column: string; value: string };
  /** Columns to select. Defaults to '*'. Narrow this to cut payload size. */
  columns?: string;
}

export function useRealtime<T extends { id: string }>(table: string, options?: RealtimeOptions) {
  const [data, setData] = useState<T[]>([]);
  const filterColumn = options?.filter?.column;
  const filterValue = options?.filter?.value;
  const columns = options?.columns ?? '*';

  useEffect(() => {
    let active = true;

    // Initial fetch (optionally scoped by a server-side WHERE)
    const fetchData = async () => {
      let q = supabase.from(table).select(columns);
      if (filterColumn && filterValue !== undefined) q = q.eq(filterColumn, filterValue);
      const { data: initialData } = await q;
      if (active && initialData) setData(initialData as unknown as T[]);
    };

    fetchData();

    // Subscribe to changes (same WHERE pushed to the realtime stream)
    const channel = supabase
      .channel(`public:${table}${filterColumn ? `:${filterColumn}=${filterValue}` : ''}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filterColumn && filterValue !== undefined
            ? { filter: `${filterColumn}=eq.${filterValue}` }
            : {}),
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as T;
            setData((prev) => (prev.some((i) => i.id === row.id) ? prev : [...prev, row]));
          } else if (payload.eventType === 'UPDATE') {
            setData((prev) => prev.map((item) => (item.id === payload.new.id ? (payload.new as T) : item)));
          } else if (payload.eventType === 'DELETE') {
            setData((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [table, filterColumn, filterValue, columns]);

  return data;
}
