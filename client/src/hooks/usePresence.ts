import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function usePresence(userId: string | null, username: string | null) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId || !username) return;

    const channel = supabase.channel('online-users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        for (const key of Object.keys(state)) {
          const presence = state[key];
          if (presence && presence[0]?.user_id) {
            ids.add(presence[0].user_id);
          }
        }
        setOnlineUserIds(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, username });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [userId, username]);

  return onlineUserIds;
}
