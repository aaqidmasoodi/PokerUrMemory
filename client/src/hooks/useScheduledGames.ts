import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchOpenGames,
  type ScheduledGameWithSeats,
  type ScheduledGame,
  type Reservation,
} from '../lib/scheduledGames';

// Module-level cache — survives screen navigation within the same session.
// null means "never fetched"; [] means "fetched, no games".
let cache: ScheduledGameWithSeats[] | null = null;

export function useScheduledGames(enabled: boolean) {
  const [games, setGames] = useState<ScheduledGameWithSeats[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  // Mutate both the React state and the module cache atomically.
  const patch = useCallback(
    (updater: (prev: ScheduledGameWithSeats[]) => ScheduledGameWithSeats[]) => {
      setGames(prev => {
        const next = updater(prev);
        cache = next;
        return next;
      });
    },
    [],
  );

  const refetch = useCallback(async () => {
    const data = await fetchOpenGames();
    cache = data;
    setGames(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // First visit ever → show spinner + fetch.
    // Return visit → use cache instantly, background-sync silently.
    if (cache === null) setLoading(true);
    refetch();

    const channel = supabase
      .channel('scheduled-games-v2')
      // ── scheduled_games ──────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scheduled_games' },
        ({ new: row }) => {
          const game = row as ScheduledGame;
          if (game.status !== 'open') return;
          patch(prev => {
            if (prev.some(g => g.id === game.id)) return prev;
            const next = [...prev, { ...game, reservations: [] }];
            next.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
            return next;
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'scheduled_games' },
        ({ new: row }) => {
          const game = row as ScheduledGame;
          patch(prev => {
            // Game closed/cancelled/expired → remove it from the list.
            if (game.status !== 'open') return prev.filter(g => g.id !== game.id);
            return prev.map(g => (g.id === game.id ? { ...g, ...game } : g));
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'scheduled_games' },
        ({ old }) => {
          const { id } = old as { id: string };
          patch(prev => prev.filter(g => g.id !== id));
        },
      )
      // ── scheduled_game_reservations ─────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scheduled_game_reservations' },
        ({ new: row }) => {
          const r = row as Reservation;
          patch(prev =>
            prev.map(g => {
              if (g.id !== r.game_id) return g;
              if (g.reservations.some(x => x.user_id === r.user_id)) return g;
              const seats = [...g.reservations, r].sort((a, b) => {
                if (a.user_id === g.host_id) return -1;
                if (b.user_id === g.host_id) return 1;
                return a.created_at.localeCompare(b.created_at);
              });
              return { ...g, reservations: seats };
            }),
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'scheduled_game_reservations' },
        ({ old }) => {
          // DEFAULT replica identity → old contains the PK columns (game_id, user_id).
          const { game_id, user_id } = old as { game_id: string; user_id: string };
          patch(prev =>
            prev.map(g => {
              if (g.id !== game_id) return g;
              return { ...g, reservations: g.reservations.filter(r => r.user_id !== user_id) };
            }),
          );
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [enabled, refetch, patch]);

  return { games, loading, refetch };
}
