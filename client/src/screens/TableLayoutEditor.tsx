import { useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, RotateCcw,
  LogOut, Volume2, BookOpen, ScrollText,
} from 'lucide-react';
import { PlayingCard } from '../components/poker/PlayingCard';
import { PlayerSeat, LayoutBox } from '../components/poker/PlayerSeat';
import { cn } from '../lib/utils';
import {
  type TableLayout, type OppCount, type ElementLayout,
  baseSizeForCount, cardSpacingForCount,
  clampEl, resetCount, resetHero,
} from '../lib/tableLayout';

const MOCK_OPP_NAMES = ['Olivia', 'Marcus', 'Priya'];
const MOCK_OPP_CHIPS = [1850, 1200, 940];

type EditorTab = OppCount | 'hero';
type Part = 'nameTag' | 'cards';
interface Sel { kind: 'hero' | 'opp'; idx: number; part: Part }

const selKey = (s: Sel) => `${s.kind}-${s.idx}-${s.part}`;

// ─── Faded stand-ins for the fixed game UI (so users see what they'd overlap) ──

function FixedUIGhost() {
  return (
    <>
      {/* TOP BAR */}
      <div
        className="absolute z-[5] flex items-center justify-between pointer-events-none opacity-25"
        style={{
          top:   'calc(0.625rem + var(--safe-top))',
          left:  'calc(0.625rem + env(safe-area-inset-left, 0px))',
          right: 'calc(0.625rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/90 shadow-sm">
            <LogOut className="w-3 h-3 text-gray-400 rotate-180" />
            <span className="font-display text-[9px] tracking-wider uppercase text-gray-400 font-semibold">Exit</span>
          </div>
          <div className="w-8 h-8 grid place-items-center rounded-full bg-white/80 shadow-sm">
            <Volume2 className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-7 px-2.5 flex items-center rounded-full bg-white/90 shadow-sm">
            <span className="font-display text-[9px] tracking-widest uppercase text-gray-400 font-semibold">Memory</span>
          </div>
          <div className="w-8 h-8 grid place-items-center rounded-full bg-white/80 shadow-sm">
            <BookOpen className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <div className="w-8 h-8 grid place-items-center rounded-full bg-white/80 shadow-sm">
            <ScrollText className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* CENTER — pot + action message */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] flex flex-col items-center gap-1.5 pointer-events-none opacity-25">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 shadow-md whitespace-nowrap">
          <div className="w-3.5 h-3.5 rounded-full bg-yellow-400 shrink-0 shadow-md" />
          <span className="font-display font-bold text-[11px] sm:text-sm text-gray-400">1,000 pts</span>
        </div>
        <div className="px-4 py-2 rounded-2xl bg-white/90 border border-black/[0.08] text-center shadow-md">
          <p className="font-display font-bold text-[13px] sm:text-[15px] text-gray-400 leading-tight">
            Memorise the cards
          </p>
        </div>
      </div>

      {/* ACTION BUTTONS — bottom-right */}
      <div
        className="absolute z-[5] flex flex-col gap-1.5 items-stretch w-[112px] sm:w-[140px] pointer-events-none opacity-20"
        style={{
          bottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))',
          right:  'calc(0.625rem + env(safe-area-inset-right, 0px))',
        }}
      >
        {['Fold', 'Check', 'Raise'].map(label => (
          <div key={label} className="h-12 rounded-xl bg-white/80 flex items-center justify-center shadow-sm">
            <span className="font-display text-[12px] uppercase tracking-wider font-bold text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// Element content (a name-tag or a card-row), used by both editable + ghost render.
function elementContent(sel: Sel, baseSize: 'normal' | 'compact' | 'mini', cardSpacing: string) {
  if (sel.part === 'nameTag') {
    return sel.kind === 'hero'
      ? <PlayerSeat name="You" chips={2000} avatar="Y" />
      : <PlayerSeat name={MOCK_OPP_NAMES[sel.idx]} chips={MOCK_OPP_CHIPS[sel.idx]} avatar={MOCK_OPP_NAMES[sel.idx].charAt(0)} size={baseSize} />;
  }
  const spacing = sel.kind === 'hero' ? 'gap-0.5 sm:gap-1' : cardSpacing;
  return (
    <div className={cn('flex', spacing)}>
      {Array.from({ length: 5 }).map((_, i) => <PlayingCard key={i} size="sm" faceUp={false} />)}
    </div>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────────

export function TableLayoutEditor({
  layout, onChange, onBack,
}: {
  layout: TableLayout;
  onChange: (l: TableLayout) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<EditorTab>('hero');
  const [selected, setSelected] = useState<Sel>({ kind: 'hero', idx: 0, part: 'nameTag' });
  const areaRef = useRef<HTMLDivElement>(null);

  const drag = useRef<
    | { mode: 'move'; sel: Sel; offX: number; offY: number; pointerId: number }
    | { mode: 'resize'; sel: Sel; startScale: number; startDist: number; cx: number; cy: number; pointerId: number }
    | null
  >(null);

  const isHeroTab = tab === 'hero';
  const oppCount: OppCount = isHeroTab ? 1 : (tab as OppCount);
  const oppSeats = layout[oppCount];
  const baseSize = baseSizeForCount(oppCount);
  const cardSpacing = cardSpacingForCount(oppCount);

  // Editable elements for the current tab.
  const elements: Sel[] = isHeroTab
    ? [{ kind: 'hero', idx: 0, part: 'nameTag' }, { kind: 'hero', idx: 0, part: 'cards' }]
    : oppSeats.flatMap((_, idx): Sel[] => [
        { kind: 'opp', idx, part: 'nameTag' },
        { kind: 'opp', idx, part: 'cards' },
      ]);

  function getEl(sel: Sel): ElementLayout {
    return sel.kind === 'hero' ? layout.hero[sel.part] : layout[oppCount][sel.idx][sel.part];
  }

  function setEl(sel: Sel, patch: Partial<ElementLayout>) {
    if (sel.kind === 'hero') {
      const cur = layout.hero[sel.part];
      onChange({ ...layout, hero: { ...layout.hero, [sel.part]: clampEl({ ...cur, ...patch }, cur) } });
    } else {
      const arr = layout[oppCount];
      const cur = arr[sel.idx][sel.part];
      const nextArr = arr.map((s, i) => (i === sel.idx ? { ...s, [sel.part]: clampEl({ ...cur, ...patch }, cur) } : s));
      onChange({ ...layout, [oppCount]: nextArr });
    }
  }

  function handleReset() {
    onChange(isHeroTab ? resetHero(layout) : resetCount(layout, tab as OppCount));
  }

  function cycleElement(dir: 1 | -1) {
    const idx = elements.findIndex(e => selKey(e) === selKey(selected));
    const next = (idx + dir + elements.length) % elements.length;
    setSelected(elements[next]);
  }

  function adjustScale(delta: number) {
    const bump = (cur: ElementLayout) =>
      ({ ...cur, scale: Math.max(0.25, Math.min(3.0, cur.scale + delta)) });
    if (selected.kind === 'hero') {
      const cur = layout.hero[selected.part];
      onChange({ ...layout, hero: { ...layout.hero, [selected.part]: bump(cur) } });
    } else {
      const seats = layout[oppCount];
      if (!seats[selected.idx]) return;
      const cur = seats[selected.idx][selected.part];
      onChange({ ...layout, [oppCount]: seats.map((s, i) =>
        i === selected.idx ? { ...s, [selected.part]: bump(cur) } : s
      )});
    }
  }

  function switchTab(t: EditorTab) {
    setTab(t);
    setSelected(t === 'hero'
      ? { kind: 'hero', idx: 0, part: 'nameTag' }
      : { kind: 'opp', idx: 0, part: 'nameTag' });
  }

  // ── Pointer geometry ──
  function pointerToPct(clientX: number, clientY: number) {
    const r = areaRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  }

  function onBodyDown(e: React.PointerEvent, sel: Sel) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(sel);
    const el = getEl(sel);
    const p = pointerToPct(e.clientX, e.clientY);
    drag.current = { mode: 'move', sel, offX: el.x - p.x, offY: el.y - p.y, pointerId: e.pointerId };
    // Capture on the stable area node so React re-renders of children don't lose capture
    areaRef.current?.setPointerCapture(e.pointerId);
  }

  function onHandleDown(e: React.PointerEvent, sel: Sel) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(sel);
    const el = getEl(sel);
    const r = areaRef.current!.getBoundingClientRect();
    const cx = r.left + (el.x / 100) * r.width;
    const cy = r.top + (el.y / 100) * r.height;
    const startDist = Math.max(20, Math.hypot(e.clientX - cx, e.clientY - cy));
    drag.current = { mode: 'resize', sel, startScale: el.scale, startDist, cx, cy, pointerId: e.pointerId };
    areaRef.current?.setPointerCapture(e.pointerId);
  }

  function onAreaMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    e.preventDefault();
    if (d.mode === 'move') {
      const p = pointerToPct(e.clientX, e.clientY);
      setEl(d.sel, { x: p.x + d.offX, y: p.y + d.offY });
    } else {
      const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
      setEl(d.sel, { scale: d.startScale * (dist / d.startDist) });
    }
  }

  function onAreaUp(e: React.PointerEvent) {
    if (drag.current && e.pointerId !== drag.current.pointerId) return;
    drag.current = null;
  }

  const tabs: { id: EditorTab; label: string }[] = [
    { id: 'hero', label: 'You' },
    { id: 1, label: '1' },
    { id: 2, label: '2' },
    { id: 3, label: '3' },
  ];

  return (
    <main
      ref={areaRef}
      onPointerMove={onAreaMove}
      onPointerUp={onAreaUp}
      onPointerCancel={onAreaUp}
      className="h-dvh w-full relative overflow-hidden select-none bg-[radial-gradient(ellipse_at_top,oklch(0.24_0.09_142)_0%,oklch(0.11_0.05_148)_100%)]"
      style={{ touchAction: 'none' }}
    >
      {/* Felt oval — same dimensions as the live table */}
      <div className="felt-surface absolute inset-x-[4%] top-[7%] bottom-[4%] rounded-[50%] -z-10 shadow-[inset_0_0_60px_rgba(0,0,0,0.5)]" />

      <FixedUIGhost />

      {/* Context ghost: the *other* group, so overlap is visible while editing */}
      {isHeroTab
        ? layout[1].flatMap((s, idx) => ([
            <LayoutBox key={`g-n-${idx}`} el={s.nameTag} className="z-[6] pointer-events-none opacity-25">
              <PlayerSeat name={MOCK_OPP_NAMES[idx]} chips={MOCK_OPP_CHIPS[idx]} avatar={MOCK_OPP_NAMES[idx].charAt(0)} size="normal" />
            </LayoutBox>,
            <LayoutBox key={`g-c-${idx}`} el={s.cards} className="z-[6] pointer-events-none opacity-25">
              <div className="flex -space-x-1">{Array.from({ length: 5 }).map((_, i) => <PlayingCard key={i} size="sm" faceUp={false} />)}</div>
            </LayoutBox>,
          ]))
        : ([
            <LayoutBox key="gh-n" el={layout.hero.nameTag} className="z-[6] pointer-events-none opacity-25">
              <PlayerSeat name="You" chips={2000} avatar="Y" />
            </LayoutBox>,
            <LayoutBox key="gh-c" el={layout.hero.cards} className="z-[6] pointer-events-none opacity-25">
              <div className="flex gap-0.5 sm:gap-1">{Array.from({ length: 5 }).map((_, i) => <PlayingCard key={i} size="sm" faceUp={false} />)}</div>
            </LayoutBox>,
          ])
      }

      {/* ── Editable elements ── */}
      {elements.map(sel => {
        const el = getEl(sel);
        const isSel = selKey(selected) === selKey(sel);
        return (
          <div
            key={selKey(sel)}
            onPointerDown={(e) => onBodyDown(e, sel)}
            className="absolute z-20 cursor-grab active:cursor-grabbing"
            style={{ left: `${el.x}%`, top: `${el.y}%`, transform: 'translate(-50%, -50%)', touchAction: 'none' }}
          >
            <div className="relative" style={{ transform: `scale(${el.scale})` }}>
              {/* Selection outline */}
              <div className={cn(
                "rounded-lg",
                isSel
                  ? "ring-2 ring-[color:var(--color-gold)] ring-offset-2 ring-offset-transparent"
                  : "ring-1 ring-white/25",
              )}>
                {elementContent(sel, baseSize, cardSpacing)}
              </div>

              {/* Resize handle — counter-scaled so it stays a constant size on screen */}
              {isSel && (
                <div
                  onPointerDown={(e) => onHandleDown(e, sel)}
                  className="absolute -bottom-5 -right-5 w-11 h-11 rounded-full grid place-items-center cursor-se-resize"
                  style={{ transform: `scale(${1 / el.scale})`, transformOrigin: 'bottom right', touchAction: 'none' }}
                >
                  <div className="w-7 h-7 rounded-full bg-[color:var(--color-gold)] border-2 border-black/30 shadow-lg grid place-items-center">
                    <ResizeGlyph />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Top bar ── */}
      <div
        className="absolute z-30 flex items-center justify-between"
        style={{
          top:   'calc(0.625rem + var(--safe-top))',
          left:  'calc(0.625rem + env(safe-area-inset-left, 0px))',
          right: 'calc(0.625rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 h-9 pl-2 pr-3 rounded-full bg-white/90 gold-border shadow-sm active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-4 h-4 text-[color:var(--color-gold)]" />
          <span className="font-display text-[10px] font-bold gold-text tracking-widest uppercase">Done</span>
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/90 gold-border shadow-sm active:scale-95 transition-transform"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[color:var(--color-gold)]" />
          <span className="font-display text-[10px] font-bold gold-text tracking-widest uppercase">Reset</span>
        </button>
      </div>

      {/* ── Left-edge tab stack ── */}
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1.5 p-1 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/10"
        style={{ paddingLeft: 'env(safe-area-inset-left, 0px)' }}
      >
        {tabs.map(({ id, label }) => (
          <button
            key={String(id)}
            onClick={() => switchTab(id)}
            className={cn(
              "w-11 h-11 rounded-xl flex flex-col items-center justify-center leading-none transition-colors",
              tab === id ? "bg-[color:var(--color-gold)] text-black" : "text-white/70 hover:text-white hover:bg-white/10",
            )}
          >
            <span className="font-display text-[12px] font-black">{label}</span>
            <span className="font-display text-[6px] tracking-widest uppercase mt-0.5 opacity-80">
              {id === 'hero' ? 'self' : id === 1 ? 'opp' : 'opps'}
            </span>
          </button>
        ))}
      </div>

      {/* ── Element controls: cycle (← →) and scale (− +) ── */}
      <div
        className="absolute z-40 flex flex-col gap-2"
        style={{
          bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
          right: 'calc(0.75rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <div className="flex gap-2">
          {([[-1, <ChevronLeft className="w-5 h-5 text-white/80" />], [1, <ChevronRight className="w-5 h-5 text-white/80" />]] as const).map(([dir, icon]) => (
            <button
              key={String(dir)}
              onPointerDown={e => { e.stopPropagation(); cycleElement(dir); }}
              className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/20 grid place-items-center active:scale-90 transition-transform shadow-lg"
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {([-0.15, 0.15] as const).map(delta => (
            <button
              key={String(delta)}
              onPointerDown={e => { e.stopPropagation(); adjustScale(delta); }}
              className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/20 grid place-items-center active:scale-90 transition-transform shadow-lg text-white/80 text-xl font-bold leading-none"
            >
              {delta < 0 ? '−' : '+'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom hint ── (pointer-events-none so the full-width wrapper doesn't
           swallow taps on the scale buttons that sit at the same height) */}
      <div
        className="absolute left-0 right-0 z-30 flex justify-center px-4 pointer-events-none"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/55 backdrop-blur-md border border-white/10 shadow-lg">
          <span className="font-display text-[9px] tracking-widest uppercase text-[color:var(--color-gold)] font-bold whitespace-nowrap">
            {selectionLabel(selected)}
          </span>
          <span className="w-px h-3 bg-white/15" />
          <span className="text-[9px] text-white/70 font-mono whitespace-nowrap">
            {Math.round(getEl(selected).scale * 100)}%
          </span>
          <span className="w-px h-3 bg-white/15" />
          <span className="text-[9px] text-white/50 tracking-wide whitespace-nowrap">
            Drag to move
          </span>
        </div>
      </div>
    </main>
  );
}

function selectionLabel(sel: Sel): string {
  const who = sel.kind === 'hero' ? 'Your' : `Opp ${sel.idx + 1}`;
  const what = sel.part === 'nameTag' ? 'name tag' : 'cards';
  return `${who} ${what}`;
}

function ResizeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H3v-6" />
      <path d="M15 3h6v6" />
      <path d="M3 21 10 14" />
      <path d="M21 3l-7 7" />
    </svg>
  );
}
