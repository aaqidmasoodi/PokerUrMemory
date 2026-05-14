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

  // Increment total_games for all players, wins for the winner
  for (const row of rows) {
    const isWinner = row.placement === 1;
    await supabase.rpc('increment_stats', {
      p_user_id: row.user_id,
      p_add_wins: isWinner ? 1 : 0,
    });
  }
}

module.exports = { supabase, recordGameResult };
