import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Crown, Plus, Search, UserPlus, UserMinus, Play, X } from 'lucide-react';
import { supabase, type Profile } from '../lib/supabase';
import { Avatar } from '../components/Avatar';
import type { Lobby } from '../hooks/useSocket';

const MAX_MEMBERS = 4;
const SEARCH_DEBOUNCE_MS = 250;

type FriendRow = { friend_id: string; profile: Profile };

export function LobbyScreen({
  profile,
  lobby,
  lobbyTransitioning,
  onlineUserIds,
  onCreateLobby,
  onLeaveLobby,
  onInvite,
  onStart,
  onBack,
}: {
  profile: Profile;
  lobby: Lobby | null;
  lobbyTransitioning: boolean;
  onlineUserIds: Set<string>;
  onCreateLobby: () => Promise<{ success: boolean; error?: string }>;
  onLeaveLobby: () => void;
  onInvite: (toUserId: string) => Promise<{ success: boolean; error?: string }>;
  onStart: () => Promise<{ success: boolean; error?: string }>;
  onBack: () => void;
}) {
  const [showFriends, setShowFriends] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Auto-create a lobby on mount if we don't have one yet
  useEffect(() => {
    if (lobby) return;
    onCreateLobby().then(res => {
      if (!res.success) setError(res.error ?? 'Could not create lobby');
    });
  }, [lobby, onCreateLobby]);

  const isHost = lobby?.hostUserId === profile.id;
  const members = lobby?.members ?? [];
  const slotCount = MAX_MEMBERS;
  const filledSlots = members.length;
  const hostMember = lobby ? members.find(m => m.userId === lobby.hostUserId) : null;

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    const res = await onStart();
    setStarting(false);
    if (!res.success) {
      setError(res.error ?? 'Could not start game');
    }
  };

  const handleLeave = () => {
    onLeaveLobby();
    onBack();
  };

  const handleInvite = useCallback(async (toUserId: string) => {
    const res = await onInvite(toUserId);
    if (!res.success) setError(res.error ?? 'Invite failed');
    return res;
  }, [onInvite]);

  return (
    <div
      className="h-dvh flex flex-col bg-transparent overflow-hidden select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.22] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />

      {/* Transition overlay */}
      {lobbyTransitioning && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[oklch(0.30_0.05_232)]/95 backdrop-blur-sm">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)] flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(212,168,67,0.4)]">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <p className="font-display text-sm tracking-[0.3em] uppercase text-white/80 mb-2">
            Starting Game…
          </p>
          <p className="text-xs text-white/50 text-center max-w-[200px] leading-relaxed">
            {members.map(m => m.username).join(' · ')} {members.length === 2 ? 'is ready' : 'are ready'} to play
          </p>
        </div>
      )}

      {/* Header */}
      <div
        className="relative shrink-0 z-10 flex items-center px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))', paddingBottom: '0.75rem' }}
      >
        <button
          onClick={handleLeave}
          className="flex items-center gap-1 h-9 pl-2 pr-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-4 h-4 text-white/70" />
          <span className="font-display text-[10px] font-bold text-white/70 tracking-widest uppercase">Leave</span>
        </button>
        <div className="absolute inset-x-0 flex flex-col items-center pointer-events-none">
          <p className="font-display text-[9px] tracking-[0.3em] uppercase text-white/60 font-semibold">Party Lobby</p>
        </div>
        {/* Slot indicator circles */}
        <div className="ml-auto flex items-center gap-1.5">
          {Array.from({ length: slotCount }).map((_, idx) => {
            const m = members[idx];
            const isMe = m?.userId === profile.id;
            const isHostSlot = m?.userId === lobby?.hostUserId;
            return (
              <div
                key={idx}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  !m
                    ? 'bg-white/15 border border-white/25'
                    : isMe
                      ? 'bg-[color:var(--color-blue)]'
                      : isHostSlot
                        ? 'bg-[color:var(--color-gold)]'
                        : 'bg-white/60'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex-1 flex flex-col items-center gap-2 px-5 py-2 overflow-y-auto">

        {/* 2×2 seat grid — fills available space */}
        <div className="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4 flex-1 min-h-0 w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
          {Array.from({ length: slotCount }).map((_, idx) => {
            const member = members[idx];
            const isMeSlot = member?.userId === profile.id;
            const isHostSlot = member?.userId === lobby?.hostUserId;

            if (!member) {
              return (
                <button
                  key={idx}
                  onClick={() => isHost && setShowFriends(true)}
                  disabled={!isHost}
                  className="flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.03] text-white/25 disabled:cursor-default active:scale-[0.97] transition-transform backdrop-blur-sm hover:border-white/25 hover:bg-white/[0.06]"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-[9px] font-display tracking-[0.2em] uppercase">
                    {isHost ? 'Invite' : 'Open Seat'}
                  </span>
                </button>
              );
            }

            return (
              <div
                key={member.userId}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-3xl backdrop-blur-sm border
                  ${isMeSlot
                    ? 'bg-[color:var(--color-blue)]/15 border-[color:var(--color-blue)]/40 shadow-[0_0_24px_rgba(0,100,255,0.12)]'
                    : isHostSlot
                      ? 'bg-white/[0.07] border-[color:var(--color-gold)]/35 shadow-[0_0_24px_rgba(212,168,67,0.08)]'
                      : 'bg-white/[0.07] border-white/10'
                  }`}
              >
                {isHostSlot && (
                  <Crown className="absolute top-3 right-3 w-3.5 h-3.5 text-[color:var(--color-gold)]" />
                )}

                {(isMeSlot || isHostSlot) ? (
                  <div className={`p-[2px] rounded-full ${
                    isMeSlot
                      ? 'bg-gradient-to-br from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)]'
                      : 'bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-soft)]'
                  }`}>
                    <div className="p-0.5 rounded-full bg-[oklch(0.35_0.05_232)]">
                      <Avatar
                        url={member.avatarUrl}
                        name={member.username}
                        size="sm"
                        className="w-14 h-14 sm:w-16 sm:h-16 text-2xl sm:text-3xl"
                      />
                    </div>
                  </div>
                ) : (
                  <Avatar
                    url={member.avatarUrl}
                    name={member.username}
                    size="sm"
                    className="w-14 h-14 sm:w-16 sm:h-16 text-2xl sm:text-3xl"
                  />
                )}

                <div className="text-center">
                  <p className={`text-[11px] sm:text-xs font-display font-bold tracking-wide ${
                    isMeSlot ? 'blue-text' : 'text-white'
                  }`}>
                    {isMeSlot ? 'You' : member.username}
                  </p>
                  {isMeSlot && (
                    <p className="text-[8px] text-white/35 tracking-widest uppercase mt-0.5">That's you</p>
                  )}
                  {isHostSlot && !isMeSlot && (
                    <p className="text-[8px] text-white/35 tracking-widest uppercase mt-0.5">Host</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hint — host with empty seats */}
        {isHost && filledSlots < slotCount && (
          <p className="shrink-0 text-[10px] text-white/40 text-center max-w-[240px] leading-relaxed">
            Tap an open seat or <span className="text-white/60 font-semibold">Invite Friends</span> below.{' '}
            Online friends receive an instant popup.
          </p>
        )}

        {error && (
          <div className="shrink-0 w-full max-w-xs rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-[11px] text-red-300 leading-snug">
            {error}
          </div>
        )}

        {/* Action bar */}
        <div className="shrink-0 w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg flex flex-col gap-2 pb-2">
          <button
            onClick={() => setShowFriends(true)}
            disabled={!lobby}
            className="w-full h-12 lg:h-13 rounded-2xl font-display tracking-[0.15em] uppercase text-[11px] font-bold bg-white/[0.08] border border-white/15 text-white backdrop-blur-sm hover:bg-white/[0.12] active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-4 h-4 text-white/60" />
            Invite Friends
          </button>

          {isHost && (
            <button
              onClick={handleStart}
              disabled={starting || filledSlots < 2}
              className="w-full h-14 lg:h-16 rounded-2xl font-display tracking-[0.15em] uppercase text-[12px] lg:text-[13px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:brightness-110 active:scale-[0.97] transition-all flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 lg:w-5 lg:h-5" />
              {starting ? 'Starting…' : filledSlots < 2 ? 'Need 1 More Player' : 'Start Game'}
            </button>
          )}

          {lobby && !isHost && (
            <div className="w-full h-14 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center gap-2.5 px-4 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-gold)] animate-pulse shrink-0" />
              <span className="font-display tracking-[0.15em] uppercase text-[10px] text-white/50">
                Waiting for {hostMember?.username ?? 'host'} to start…
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Friends slide-out panel */}
      <FriendsPanel
        open={showFriends}
        onClose={() => setShowFriends(false)}
        currentUserId={profile.id}
        onlineUserIds={onlineUserIds}
        inLobbyUserIds={new Set(members.map(m => m.userId))}
        canInvite={isHost && filledSlots < MAX_MEMBERS}
        onInvite={handleInvite}
      />
    </div>
  );
}

// ─── FriendsPanel — slide-out with search + friends list ─────────────────────

function FriendsPanel({
  open,
  onClose,
  currentUserId,
  onlineUserIds,
  inLobbyUserIds,
  canInvite,
  onInvite,
}: {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  onlineUserIds: Set<string>;
  inLobbyUserIds: Set<string>;
  canInvite: boolean;
  onInvite: (toUserId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [feedback, setFeedback] = useState<{ userId: string; text: string; ok: boolean } | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const refreshFriends = useCallback(async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select('friend_id, profile:profiles!friendships_friend_id_fkey(*)')
      .eq('user_id', currentUserId);
    if (error) { console.error('[friends] load failed', error); return; }
    setFriends((data ?? []) as unknown as FriendRow[]);
  }, [currentUserId]);

  useEffect(() => {
    if (open) refreshFriends();
  }, [open, refreshFriends]);

  // Debounced username search
  useEffect(() => {
    const q = query.trim();
    if (!q) { setSearchResults([]); return; }

    setLoadingSearch(true);
    // Escape LIKE wildcards so a literal %, _ or \ in the query isn't treated as a
    // pattern (otherwise typing "%" would match every user).
    const escaped = q.replace(/[\\%_]/g, c => `\\${c}`);
    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `${escaped}%`)
        .neq('id', currentUserId)
        .order('username')
        .limit(10);
      setLoadingSearch(false);
      if (error) { console.error('[search] failed', error); return; }
      setSearchResults((data ?? []) as Profile[]);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query, currentUserId]);

  const friendIds = new Set(friends.map(f => f.friend_id));

  const showFeedback = (userId: string, text: string, ok: boolean) => {
    setFeedback({ userId, text, ok });
    setTimeout(() => setFeedback(prev => prev?.userId === userId ? null : prev), 2000);
  };

  const showToast = (text: string, ok: boolean) => {
    setToast({ text, ok });
    setTimeout(() => setToast(prev => prev?.text === text ? null : prev), 4000);
  };

  const addFriend = async (friendId: string, username: string) => {
    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: currentUserId, friend_id: friendId });
    if (error) {
      showFeedback(friendId, 'Failed', false);
      showToast(error.message || 'Could not add friend', false);
      return;
    }
    showFeedback(friendId, 'Added', true);
    showToast(`Added ${username} to your friends`, true);
    refreshFriends();
  };

  const removeFriend = async (friendId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('user_id', currentUserId)
      .eq('friend_id', friendId);
    if (error) {
      showFeedback(friendId, 'Failed', false);
      showToast(error.message || 'Could not remove friend', false);
      return;
    }
    refreshFriends();
  };

  const handleInvite = async (toUserId: string, username: string) => {
    const res = await onInvite(toUserId);
    showFeedback(toUserId, res.success ? 'Invited' : (res.error ?? 'Failed'), res.success);
    showToast(
      res.success ? `Invite sent to ${username}: they should see a popup now.` : (res.error ?? 'Invite failed'),
      res.success,
    );
  };

  // Online friends first
  const sortedFriends = [...friends].sort((a, b) => {
    const aOn = onlineUserIds.has(a.friend_id) ? 0 : 1;
    const bOn = onlineUserIds.has(b.friend_id) ? 0 : 1;
    if (aOn !== bOn) return aOn - bOn;
    return a.profile.username.localeCompare(b.profile.username);
  });

  const showingSearch = query.trim().length > 0;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[200]" onClick={onClose} />
      )}
      <div
        className={`fixed top-0 right-0 h-full z-[210] w-[320px] sm:w-[360px] flex flex-col
        bg-white/97 border-l border-[color:var(--color-gold)]/30 shadow-2xl backdrop-blur-xl
        transform transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.07]">
          <span className="font-display text-xs tracking-widest uppercase blue-text font-semibold">Friends</span>
          <button onClick={onClose} className="w-7 h-7 grid place-items-center rounded-full hover:bg-gray-100">
            <X className="w-3.5 h-3.5 text-gray-300" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-black/[0.06] space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search username"
              className="w-full bg-white border border-black/[0.10] rounded-full pl-9 pr-3 py-2 text-[12px] focus:border-[color:var(--color-blue)]/70 outline-none shadow-sm"
            />
          </div>
          <p className="text-[10px] text-gray-300 leading-snug px-1">
            <span className="font-semibold">Add Friend</span> saves them to your list (silent).{' '}
            <span className="font-semibold">Invite</span> sends an instant popup to their device.
          </p>
        </div>

        {/* Toast — sticky action result */}
        {toast && (
          <div
            className={`mx-3 mt-3 rounded-xl px-3 py-2 text-[11px] leading-snug border ${
              toast.ok
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {showingSearch ? (
            <UserList
              title="Search Results"
              users={searchResults}
              emptyText={loadingSearch ? 'Searching…' : 'No matches'}
              renderActions={(u) => (
                <div className="flex items-center gap-1.5">
                  {friendIds.has(u.id) ? (
                    <span className="h-7 px-2 rounded-full bg-[color:var(--color-blue)]/10 text-[color:var(--color-blue)] text-[9px] font-display tracking-wider uppercase flex items-center gap-1">
                      <UserPlus className="w-2.5 h-2.5" /> Friend
                    </span>
                  ) : (
                    <button
                      onClick={() => addFriend(u.id, u.username)}
                      className="h-7 px-2.5 rounded-full bg-white border border-[color:var(--color-blue)]/40 text-[color:var(--color-blue)] text-[9px] font-display tracking-wider uppercase shadow-sm active:scale-[0.97] flex items-center gap-1"
                    >
                      <UserPlus className="w-2.5 h-2.5" /> Add Friend
                    </button>
                  )}
                  {canInvite && !inLobbyUserIds.has(u.id) && (
                    <button
                      onClick={() => handleInvite(u.id, u.username)}
                      disabled={!onlineUserIds.has(u.id)}
                      title={!onlineUserIds.has(u.id) ? 'User is offline' : 'Send a popup invite'}
                      className="h-7 px-2.5 rounded-full bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white text-[9px] font-display tracking-wider uppercase shadow active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Invite
                    </button>
                  )}
                </div>
              )}
              onlineUserIds={onlineUserIds}
              feedback={feedback}
            />
          ) : (
            <UserList
              title="Your Friends"
              users={sortedFriends.map(f => f.profile)}
              emptyText="No friends yet. Search by username to add some."
              renderActions={(u) => (
                <div className="flex items-center gap-1.5">
                  {canInvite && !inLobbyUserIds.has(u.id) ? (
                    <button
                      onClick={() => handleInvite(u.id, u.username)}
                      disabled={!onlineUserIds.has(u.id)}
                      title={!onlineUserIds.has(u.id) ? 'User is offline' : 'Send a popup invite'}
                      className="h-7 px-2.5 rounded-full bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white text-[9px] font-display tracking-wider uppercase shadow active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Invite
                    </button>
                  ) : inLobbyUserIds.has(u.id) ? (
                    <span className="h-7 px-2.5 rounded-full bg-[color:var(--color-gold)]/15 text-[color:var(--color-gold)] text-[9px] font-display tracking-wider uppercase flex items-center">
                      In Party
                    </span>
                  ) : null}
                  <button
                    onClick={() => removeFriend(u.id)}
                    className="w-7 h-7 grid place-items-center rounded-full bg-gray-100 hover:bg-red-50 text-gray-300 hover:text-red-500"
                    title="Remove friend"
                  >
                    <UserMinus className="w-3 h-3" />
                  </button>
                </div>
              )}
              onlineUserIds={onlineUserIds}
              feedback={feedback}
            />
          )}
        </div>
      </div>
    </>
  );
}

function UserList({
  title,
  users,
  emptyText,
  renderActions,
  onlineUserIds,
  feedback,
}: {
  title: string;
  users: Profile[];
  emptyText: string;
  renderActions: (u: Profile) => React.ReactNode;
  onlineUserIds: Set<string>;
  feedback: { userId: string; text: string; ok: boolean } | null;
}) {
  return (
    <div className="py-2">
      <p className="px-4 py-1.5 text-[9px] font-display tracking-widest uppercase text-gray-300">
        {title}
      </p>
      {users.length === 0 ? (
        <p className="px-4 py-6 text-[11px] text-gray-300 text-center italic leading-relaxed">
          {emptyText}
        </p>
      ) : (
        <ul>
          {users.map(u => {
            const isOnline = onlineUserIds.has(u.id);
            const fb = feedback?.userId === u.id ? feedback : null;
            return (
              <li key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                <div className="relative">
                  <Avatar url={u.avatar_url} name={u.username} size="sm" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      isOnline ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold truncate">{u.username}</p>
                  <p className="text-[9px] text-gray-300">{isOnline ? 'Online' : 'Offline'}</p>
                </div>
                {fb ? (
                  <span className={`text-[9px] font-display tracking-wider uppercase ${fb.ok ? 'text-green-600' : 'text-red-500'}`}>
                    {fb.text}
                  </span>
                ) : (
                  renderActions(u)
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
