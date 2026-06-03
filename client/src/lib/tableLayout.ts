// ─── Table layout customisation ───────────────────────────────────────────────
//
// Players directly arrange their table: every name-tag and card-row is an
// independent object with its own position + size. Because the table is capped at
// 4 players (gameRoom.js) there are only ever 1, 2 or 3 opponents — so we keep one
// independent layout per opponent count, plus one for the hero (own seat).
//
// Positions are the CENTRE of each element as PERCENTAGES of the game screen (not
// pixels) so a layout survives rotation, notches and different devices. Storage is
// per-device (localStorage).

export type SeatSize = 'normal' | 'compact' | 'mini';
export type OppCount = 1 | 2 | 3;

/** A single directly-manipulated object (a name-tag or a card-row). */
export interface ElementLayout {
  /** Centre X, as % of screen width. */
  x: number;
  /** Centre Y, as % of screen height. */
  y: number;
  /** Size multiplier. */
  scale: number;
}

/** A player's two independent elements. */
export interface SeatLayout {
  nameTag: ElementLayout;
  cards: ElementLayout;
}

export interface TableLayout {
  1: SeatLayout[];
  2: SeatLayout[];
  3: SeatLayout[];
  hero: SeatLayout;
}

export const LIMITS = {
  x:     [3,   97]  as const,
  y:     [3,   97]  as const,
  scale: [0.5, 2.0] as const,
};

// Defaults reproduce the original look: opponents in a row near the top (name-tag
// above its cards), hero bottom-left (name-tag left of its cards).
function seat(nx: number, ny: number, cx: number, cy: number): SeatLayout {
  return {
    nameTag: { x: nx, y: ny, scale: 1 },
    cards:   { x: cx, y: cy, scale: 1 },
  };
}

export const DEFAULT_TABLE_LAYOUT: TableLayout = {
  1: [seat(50, 10, 50, 20)],
  2: [seat(30, 10, 30, 20), seat(70, 10, 70, 20)],
  3: [seat(20, 10, 20, 20), seat(50, 10, 50, 20), seat(80, 10, 80, 20)],
  hero: seat(14, 84, 37, 84),
};

// Storage key — bumped to v4 for the independent-element model.
const STORAGE_KEY = 'pum.tableLayout.v4';
const COUNTS: OppCount[] = [1, 2, 3];

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

export function clampEl(raw: Partial<ElementLayout> | undefined, fallback: ElementLayout): ElementLayout {
  return {
    x:     clampNum(raw?.x,     LIMITS.x[0],     LIMITS.x[1],     fallback.x),
    y:     clampNum(raw?.y,     LIMITS.y[0],     LIMITS.y[1],     fallback.y),
    scale: clampNum(raw?.scale, LIMITS.scale[0], LIMITS.scale[1], fallback.scale),
  };
}

export function clampSeat(raw: Partial<SeatLayout> | undefined, fallback: SeatLayout): SeatLayout {
  return {
    nameTag: clampEl(raw?.nameTag, fallback.nameTag),
    cards:   clampEl(raw?.cards,   fallback.cards),
  };
}

export function normalizeLayout(raw: unknown): TableLayout {
  const input = (raw ?? {}) as Record<string, unknown>;
  const out = {} as TableLayout;
  for (const count of COUNTS) {
    const defaults = DEFAULT_TABLE_LAYOUT[count];
    const arr = Array.isArray(input[count]) ? (input[count] as Partial<SeatLayout>[]) : [];
    out[count] = defaults.map((def, i) => clampSeat(arr[i], def));
  }
  out.hero = clampSeat(
    typeof input.hero === 'object' && input.hero !== null ? (input.hero as Partial<SeatLayout>) : undefined,
    DEFAULT_TABLE_LAYOUT.hero,
  );
  return out;
}

export function loadTableLayout(): TableLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLayout(JSON.parse(stored));
  } catch { /* corrupt / unavailable → defaults */ }
  return normalizeLayout(null);
}

export function saveTableLayout(layout: TableLayout): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch { /* ignore */ }
}

export function resetCount(layout: TableLayout, count: OppCount): TableLayout {
  return { ...layout, [count]: DEFAULT_TABLE_LAYOUT[count].map(s => structuredCloneSeat(s)) };
}

export function resetHero(layout: TableLayout): TableLayout {
  return { ...layout, hero: structuredCloneSeat(DEFAULT_TABLE_LAYOUT.hero) };
}

function structuredCloneSeat(s: SeatLayout): SeatLayout {
  return { nameTag: { ...s.nameTag }, cards: { ...s.cards } };
}

export function baseSizeForCount(count: number): SeatSize {
  return count >= 3 ? 'mini' : count >= 2 ? 'compact' : 'normal';
}

export function cardSpacingForCount(count: number): string {
  return count >= 3 ? '-space-x-3' : count >= 2 ? '-space-x-2' : '-space-x-1';
}

export function clampCount(count: number): OppCount {
  return Math.min(3, Math.max(1, count)) as OppCount;
}
