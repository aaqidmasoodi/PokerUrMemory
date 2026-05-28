const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

  // Increment total_games for all players, wins for the winner — run concurrently.
  await Promise.all(rows.map(row =>
    supabase.rpc('increment_stats', {
      p_user_id: row.user_id,
      p_add_wins: row.placement === 1 ? 1 : 0,
    })
  ));
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

module.exports = { supabase, recordGameResult, recordHand };
