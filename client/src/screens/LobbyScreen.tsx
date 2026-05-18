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
      className="h-dvh flex flex-col bg-[var(--color-background)] overflow-hidden select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="absolute inset-0 felt-surface opacity-[0.12] pointer-events-none" />

      {/* Transition overlay - keeps showing party while game starts */}
      {lobbyTransitioning && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-background)]/95 backdrop-blur-sm">
          <div className="w-16 h-16 rounded-3xl bg-white/80 border border-black/[0.08] shadow-lg flex items-center justify-center gap-3 mb-6">
            <Crown className="w-6 h-6 text-[color:var(--color-gold)]" />
          </div>
          <p className="font-display text-sm tracking-wider uppercase text-gray-600 mb-2">
            Starting Game…
          </p>
          <p className="text-xs text-gray-400 text-center max-w-[200px] leading-relaxed">
            {members.map(m => m.username).join(' · ')} {members.length === 2 ? 'is ready' : 'are ready'} to play
          </p>
        </div>
      )}

      {/* Header — background bleeds edge-to-edge, content sits inside safe area */}
      <div
        className="relative shrink-0 flex items-center gap-3 border-b border-black/[0.07] bg-white/60 backdrop-blur-sm"
        style={{
          marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
          marginLeft: 'calc(-1 * env(safe-area-inset-left, 0px))',
          marginRight: 'calc(-1 * env(safe-area-inset-right, 0px))',
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
          paddingBottom: '0.75rem',
          paddingLeft: 'calc(1rem + env(safe-area-inset-left, 0px))',
          paddingRight: 'calc(1rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <button
          onClick={handleLeave}
          className="w-8 h-8 grid place-items-center rounded-full bg-white border border-black/[0.08] shadow-sm active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="font-display text-sm [@media(orientation:landscape)]:text-base font-bold blue-text tracking-wider uppercase">
          Party
        </h1>
      </div>

      {/* Body */}
      <div className="relative flex-1 flex flex-col [@media(orientation:landscape)]:flex-row overflow-hidden">

        {/* Members slot grid */}
        <div className="px-5 py-5 flex flex-col items-center gap-4
          [@media(orientation:landscape)]:w-[45%] [@media(orientation:landscape)]:justify-center
          [@media(orientation:landscape)]:border-r [@media(orientation:landscape)]:border-black/[0.07]">

          <p className="text-[10px] font-display tracking-widest uppercase text-gray-400 text-center">
            {!lobby ? 'Setting up your party…'
              : isHost
                ? `${filledSlots} / ${slotCount} Players · You're the host`
                : `${filledSlots} / ${slotCount} Players · ${hostMember?.username ?? 'Host'}'s party`}
          </p>

          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
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
                    className="flex flex-col items-center justify-center gap-1.5 h-[88px] rounded-2xl bg-white/40 border-2 border-dashed border-black/15 text-gray-400 disabled:cursor-default active:scale-[0.97] transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-[9px] font-display tracking-wider uppercase">
                      {isHost ? 'Invite' : 'Empty'}
                    </span>
                  </button>
                );
              }

              return (
                <div
                  key={member.userId}
                  className="relative flex flex-col items-center justify-center gap-1.5 h-[88px] rounded-2xl bg-white/80 border border-black/[0.08] shadow-sm"
                >
                  {isHostSlot && (
                    <Crown className="absolute top-1.5 right-1.5 w-3 h-3 text-[color:var(--color-gold)]" />
                  )}
                  <Avatar url={member.avatarUrl} name={member.username} size="sm" />
                  <span className="text-[10px] font-display font-semibold truncate max-w-[80px]">
                    {isMeSlot ? 'You' : member.username}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hint — only show when host has empty seats */}
          {isHost && filledSlots < slotCount && (
            <p className="text-[10px] text-gray-500 text-center max-w-[240px] leading-relaxed">
              Tap an empty slot or <span className="font-semibold">Invite Friends</span> to fill the party. Online friends get an instant popup.
            </p>
          )}

          {error && (
            <div className="w-full max-w-xs rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-700 leading-snug">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-1 px-5 pb-5 flex flex-col gap-2.5 justify-end [@media(orientation:landscape)]:justify-center [@media(orientation:landscape)]:py-5">
          <div className="w-full max-w-xs mx-auto flex flex-col gap-2.5">
            <button
              onClick={() => setShowFriends(true)}
              disabled={!lobby}
              className="w-full h-12 rounded-2xl font-display tracking-wider uppercase text-[11px] font-bold bg-white/80 text-foreground border border-black/[0.10] shadow-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-3.5 h-3.5 text-[color:var(--color-blue)]" />
              Invite Friends
            </button>

            {isHost && (
              <button
                onClick={handleStart}
                disabled={starting || filledSlots < 2}
                className="w-full h-14 rounded-2xl font-display tracking-wider uppercase text-[12px] font-bold bg-gradient-to-b from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white border border-black/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)] active:scale-[0.97] transition-transform flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                {starting ? 'Starting…' : filledSlots < 2 ? 'Need 1 more player' : 'Start Game'}
              </button>
            )}

            {lobby && !isHost && (
              <div className="w-full h-14 rounded-2xl font-display tracking-wider uppercase text-[11px] bg-white/60 text-gray-500 border border-black/[0.07] flex items-center justify-center text-center px-4">
                Waiting for {hostMember?.username ?? 'host'} to start…
              </div>
            )}
          </div>
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
    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `${q}%`)
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
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-black/[0.06] space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search username"
              className="w-full bg-white border border-black/[0.10] rounded-full pl-9 pr-3 py-2 text-[12px] focus:border-[color:var(--color-blue)]/70 outline-none shadow-sm"
            />
          </div>
          <p className="text-[10px] text-gray-500 leading-snug px-1">
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
                    className="w-7 h-7 grid place-items-center rounded-full bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500"
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
      <p className="px-4 py-1.5 text-[9px] font-display tracking-widest uppercase text-gray-400">
        {title}
      </p>
      {users.length === 0 ? (
        <p className="px-4 py-6 text-[11px] text-gray-400 text-center italic leading-relaxed">
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
                  <p className="text-[9px] text-gray-400">{isOnline ? 'Online' : 'Offline'}</p>
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
