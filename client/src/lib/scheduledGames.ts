import { supabase, type Profile } from './supabase';

export type ScheduledGameStatus = 'open' | 'live' | 'completed' | 'cancelled' | 'expired';

export type ScheduledGame = {
  id: string;
  host_id: string;
  host_username: string;
  host_country_code: string | null;
  host_avatar_url: string | null;
  scheduled_at: string; // ISO (UTC)
  max_players: number;
  status: ScheduledGameStatus;
  room_code: string | null;
  game_session_id: string | null;
  created_at: string;
};

export type Reservation = {
  game_id: string;
  user_id: string;
  username: string;
  country_code: string | null;
  avatar_url: string | null;
  created_at: string;
};

// A scheduled game enriched with its reservation list (host first).
export type ScheduledGameWithSeats = ScheduledGame & {
  reservations: Reservation[];
};

const MAX_HOURS_AHEAD = 48;

export function maxScheduleDate(now = new Date()): Date {
  return new Date(now.getTime() + MAX_HOURS_AHEAD * 60 * 60 * 1000);
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createScheduledGame(
  profile: Profile,
  scheduledAtISO: string,
  maxPlayers = 4,
): Promise<{ data: ScheduledGame | null; error: string | null }> {
  const { data, error } = await supabase
    .from('scheduled_games')
    .insert({
      host_id: profile.id,
      host_username: profile.username,
      host_country_code: profile.country_code,
      host_avatar_url: profile.avatar_url,
      scheduled_at: scheduledAtISO,
      max_players: maxPlayers,
    })
    .select()
    .single();
  return { data: (data as ScheduledGame) ?? null, error: error?.message ?? null };
}

export async function cancelScheduledGame(gameId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('scheduled_games')
    .update({ status: 'cancelled' })
    .eq('id', gameId);
  return { error: error?.message ?? null };
}

export async function reserveSpot(gameId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('reserve_spot', { p_game_id: gameId });
  return { error: error?.message ?? null };
}

export async function cancelReservation(
  gameId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('scheduled_game_reservations')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', userId);
  return { error: error?.message ?? null };
}

export async function kickPlayer(
  gameId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('kick_player', { p_game_id: gameId, p_user_id: userId });
  return { error: error?.message ?? null };
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function fetchMyGameHistory(userId: string): Promise<ScheduledGame[]> {
  const { data, error } = await supabase
    .from('scheduled_games')
    .select('*')
    .eq('host_id', userId)
    .in('status', ['expired', 'cancelled', 'completed'])
    .order('scheduled_at', { ascending: false });
  if (error) console.error('[scheduled] fetch game history failed', error);
  return (data as ScheduledGame[]) ?? [];
}

export async function fetchOpenGames(): Promise<ScheduledGameWithSeats[]> {
  const { data: games, error } = await supabase
    .from('scheduled_games')
    .select('*')
    .eq('status', 'open')
    .order('scheduled_at', { ascending: true });

  if (error || !games || games.length === 0) {
    if (error) console.error('[scheduled] fetch games failed', error);
    return [];
  }

  const ids = (games as ScheduledGame[]).map(g => g.id);
  const { data: reservations, error: rErr } = await supabase
    .from('scheduled_game_reservations')
    .select('*')
    .in('game_id', ids)
    .order('created_at', { ascending: true });

  if (rErr) console.error('[scheduled] fetch reservations failed', rErr);

  const byGame = new Map<string, Reservation[]>();
  for (const r of (reservations ?? []) as Reservation[]) {
    const list = byGame.get(r.game_id) ?? [];
    list.push(r);
    byGame.set(r.game_id, list);
  }

  return (games as ScheduledGame[]).map(g => {
    const seats = byGame.get(g.id) ?? [];
    // Host first, then by reservation time.
    seats.sort((a, b) => {
      if (a.user_id === g.host_id) return -1;
      if (b.user_id === g.host_id) return 1;
      return a.created_at.localeCompare(b.created_at);
    });
    return { ...g, reservations: seats };
  });
}

// ─── Time formatting helpers (viewer's local timezone) ───────────────────────

export function formatLocalDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function localTimeZoneLabel(): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

// Returns a compact countdown like "1d 4h", "3h 12m", "5m 09s", or "Starting now".
export function formatCountdown(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'Starting now';

  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}
