const { supabase } = require('./supabase');
const { GameRoom } = require('./gameRoom');

const MATCH_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 3_000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

function generateRoomCode(rooms) {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms.has(code));
  return code;
}

async function runMatchmaking(rooms, io) {
  const { data: waiting, error } = await supabase
    .from('matchmaking_queue')
    .select('*')
    .eq('status', 'waiting')
    .order('joined_at', { ascending: true });

  if (error || !waiting || waiting.length === 0) return;

  const now = Date.now();

  // Expire timed-out entries
  const timedOut = waiting.filter(e => now - new Date(e.joined_at).getTime() > MATCH_TIMEOUT_MS);
  if (timedOut.length > 0) {
    await supabase
      .from('matchmaking_queue')
      .update({ status: 'timeout' })
      .in('id', timedOut.map(e => e.id));
  }

  const fresh = waiting.filter(e => now - new Date(e.joined_at).getTime() <= MATCH_TIMEOUT_MS);

  // Deduplicate by user_id — keep only the most recent entry per user,
  // cancel all older duplicates so they don't accumulate.
  const latestByUser = new Map();
  for (const entry of fresh) {
    const existing = latestByUser.get(entry.user_id);
    if (!existing || new Date(entry.joined_at) > new Date(existing.joined_at)) {
      if (existing) {
        // Cancel the older duplicate immediately
        supabase.from('matchmaking_queue').update({ status: 'cancelled' }).eq('id', existing.id).then(() => {});
      }
      latestByUser.set(entry.user_id, entry);
    } else {
      // This entry is older than one we already have — cancel it
      supabase.from('matchmaking_queue').update({ status: 'cancelled' }).eq('id', entry.id).then(() => {});
    }
  }

  const eligible = Array.from(latestByUser.values());
  if (eligible.length < MIN_PLAYERS) return;

  const batch = eligible.slice(0, MAX_PLAYERS);
  const roomCode = generateRoomCode(rooms);

  const { data: session, error: sessionErr } = await supabase
    .from('game_sessions')
    .insert({ room_code: roomCode, player_count: batch.length, status: 'forming' })
    .select()
    .single();

  if (sessionErr || !session) {
    console.error('[matchmaking] Failed to create game session:', sessionErr);
    return;
  }

  await supabase
    .from('matchmaking_queue')
    .update({ status: 'matched', game_id: session.id, room_code: roomCode })
    .in('id', batch.map(e => e.id));

  const room = new GameRoom(roomCode, null, io);
  room.gameSessionId = session.id;
  room.expectedPlayerCount = batch.length;
  room.matchedUserIds = batch.map(e => e.user_id);
  rooms.set(roomCode, room);

  console.log(`[matchmaking] Matched ${batch.length} players → room ${roomCode}`);
}

function startMatchmakingLoop(rooms, io) {
  setInterval(() => {
    runMatchmaking(rooms, io).catch(err => console.error('[matchmaking] error:', err));
  }, POLL_INTERVAL_MS);
  console.log('[matchmaking] Loop started');
}

module.exports = { startMatchmakingLoop };
