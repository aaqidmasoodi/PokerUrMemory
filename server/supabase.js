const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Called when the first hand deals — increments total_games for all seated human
// players and marks the session as active. Bots (userId=null) are filtered out.
async function recordGameStart({ gameSessionId, players }) {
  const userIds = players.map(p => p.userId).filter(Boolean);
  if (userIds.length === 0) return;

  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD' UTC

  const [startRes, ...streakResults] = await Promise.all([
    supabase.rpc('record_game_start', {
      p_user_ids: userIds,
      p_game_id: gameSessionId ?? null,
    }),
    ...userIds.map(id =>
      supabase.rpc('touch_streak', { p_user_id: id, p_today: today })
    ),
  ]);

  if (startRes.error) console.error('[stats] record_game_start error:', startRes.error);
  streakResults.forEach((r, i) => {
    if (r.error) console.error(`[stats] touch_streak error for ${userIds[i]}:`, r.error);
    else console.log(`[stats] streak for ${userIds[i]} → ${r.data}`);
  });
}

async function recordGameResult({ gameSessionId, players }) {
  if (!gameSessionId) return;

  const sorted = [...players].sort((a, b) => b.chips - a.chips);

  // Write game_players rows
  const rows = sorted.map((p, idx) => ({
    game_id: gameSessionId,
    user_id: p.userId,
    username: p.name,
    final_chips: p.chips,
    placement: idx + 1,
  })).filter(r => r.user_id);

  if (rows.length > 0) {
    await supabase.from('game_players').insert(rows);
  }

  // Mark session completed
  await supabase
    .from('game_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', gameSessionId);

  // Increment wins for the winner only.
  // total_games and streaks are already handled at game start via recordGameStart.
  await Promise.all(rows
    .filter(row => row.placement === 1)
    .map(row => supabase.rpc('increment_stats', {
      p_user_id: row.user_id,
      p_add_wins: 1,
    }))
  );
}

// Record a single completed hand. Idempotent on (gameSessionId, handNumber) — safe
// to call twice without doubling stats. `players` shape:
//   { userId, amountWon, amountContributed, handRank, handDescription, folded }
async function recordHand({ gameSessionId, handNumber, potAmount, endedBy, players }) {
  if (!gameSessionId) return;

  const payload = players
    .filter(p => p.userId)
    .map(p => ({
      user_id:            p.userId,
      amount_won:         p.amountWon ?? 0,
      amount_contributed: p.amountContributed ?? 0,
      hand_rank:          p.handRank ?? null,
      hand_description:   p.handDescription ?? null,
      folded:             !!p.folded,
    }));

  if (payload.length === 0) return;

  const { error } = await supabase.rpc('record_hand', {
    p_game_id:     gameSessionId,
    p_hand_number: handNumber,
    p_pot_amount:  potAmount,
    p_ended_by:    endedBy,
    p_players:     payload,
  });
  if (error) throw error;
}

module.exports = { supabase, recordGameStart, recordGameResult, recordHand };
