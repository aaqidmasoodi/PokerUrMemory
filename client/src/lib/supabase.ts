import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce' },
});

export type Profile = {
  id: string;
  username: string;
  country_code: string | null;
  avatar_url: string | null;
  total_games: number;
  wins: number;
  hands_played: number;
  hands_won: number;
  pots_won_total: number;
  biggest_pot_won: number;
  best_hand_rank: number;
  best_hand_name: string | null;
  current_streak: number;
  longest_streak: number;
  last_played_date: string | null;
  xp: number;
  checkin_streak: number;
  longest_checkin_streak: number;
  last_checkin_date: string | null;
  created_at: string;
};
