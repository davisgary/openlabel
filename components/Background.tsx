"use client";
import React, { useEffect, useState } from 'react';
import CircularScore from './scan/CircularScore';
import { mapRatingToScore, ratingColor, ratingTextColor } from './scan/utils';
import { LuBadgeCheck, LuBadgeMinus, LuBadgeInfo, LuBadgeHelp } from 'react-icons/lu';
import ENUMS from '../lib/e-numbers.json';

type Example = {
  id: string;
  name: string;
  score: number;
  top: string;
  left: string;
  size?: number;
  rotate?: string;
  additives?: string[];
  preservatives?: string[];
  allergens?: string[];
};

// Additive/preservative classification rules are stored in a shared JSON file so
// other modules (e.g. components/scan/utils.ts) can import the same rules.
// If you want to change rules, edit `lib/additive-rules.json`.
import ADDITIVE_RULES from '../lib/additive-rules.json';

const EXAMPLES: Example[] = [
  { id: 'e1', name: 'Granola Bar', score: 88, top: '8%', left: '6%', size: 72, rotate: '-3deg', additives: ['Vitamin C', 'E300'], preservatives: ['Ascorbic acid'], allergens: ['Peanuts'] },
  { id: 'e2', name: 'Sparkling Soda', score: 52, top: '30%', left: '72%', size: 64, rotate: '6deg', additives: ['E211', 'Citric acid'], preservatives: ['Sodium benzoate'] },
  { id: 'e3', name: 'Canned Meat', score: 62, top: '62%', left: '18%', size: 72, rotate: '-6deg', additives: ['E250', 'Nitrite'], preservatives: ['Nitrite'] },
  { id: 'e4', name: 'Yogurt', score: 76, top: '48%', left: '52%', size: 56, rotate: '10deg', additives: ['Live cultures', 'Ascorbic acid'], preservatives: ['Citric acid'], allergens: ['Milk'] },
  { id: 'e5', name: 'Chips', score: 80, top: '12%', left: '50%', size: 68, rotate: '-12deg', additives: ['E621', 'Flavouring'], preservatives: ['E320'], allergens: ['Soy'] },
  { id: 'e6', name: 'Organic Honey', score: 100, top: '6%', left: '8%', size: 72, rotate: '4deg', additives: ['Propolis', 'Honey'], preservatives: ['Ascorbic acid'] },
];

export default function Background({ className }: { className?: string }) {
  const [positions, setPositions] = useState(EXAMPLES.map((ex) => ({
    id: ex.id,
    top: ex.top,
    left: ex.left,
    rotate: ex.rotate ?? '0deg',
  })));
  const [pillLayout, setPillLayout] = useState<Record<string, any[]>>({});
  const [cardLayout, setCardLayout] = useState<Record<string, { top: string; left: string; rotate: string; icon?: number; iconRotate?: string }>>({});
  const [globalPills, setGlobalPills] = useState<any[]>([]);

  // build regexes from embedded rules
  const makeRe = (arr: any[]) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const tokens = arr.map((s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp('(' + tokens.join('|') + ')', 'i');
  };

  const GOOD_RE = makeRe(ADDITIVE_RULES.good) ?? /(ascorbic|citric|tocopherol|vitamin|malic)/i;
  const OK_RE = makeRe(ADDITIVE_RULES.ok) ?? /(sorbate|benzoate|propionat|propionic|sulfite|sulphite|edta|curcumin|turmeric)/i;
  const BAD_RE = makeRe(ADDITIVE_RULES.bad) ?? /(nitrite|nitrate|nitros|bht|bha|e320|e321)/i;

  function additiveRatingLocal(name: string): 'good' | 'ok' | 'bad' {
    const n = String(name || '').trim();
    if (BAD_RE.test(n)) return 'bad';
    if (OK_RE.test(n)) return 'ok';
    if (GOOD_RE.test(n)) return 'good';
    return 'ok';
  }

  useEffect(() => {
    // Randomize positions slightly on mount so examples are scattered
    setPositions((prev) => prev.map((p) => {
      const parsePct = (v: string) => parseFloat(String(v).replace('%', '')) || 0;
      const clamp = (v: number) => Math.max(4, Math.min(96, Math.round(v * 10) / 10));
      const ex = EXAMPLES.find((e) => e.id === p.id)!;
      const baseTop = parsePct(ex.top as string);
      const baseLeft = parsePct(ex.left as string);
      const jitter = () => (Math.random() * 16 - 8); // +/-8%
      const newTop = clamp(baseTop + jitter());
      const newLeft = clamp(baseLeft + jitter());
      const baseRotate = parseFloat(String(ex.rotate ?? '0deg').replace(/deg/, '')) || 0;
      const newRotate = `${Math.round(baseRotate + (Math.random() * 20 - 10))}deg`;
      return { ...p, top: `${newTop}%`, left: `${newLeft}%`, rotate: newRotate };
    }));

    // Global layout: place cards and pills across the viewport with spacing
    const placedCards: Array<{ id: string; x: number; y: number; rotate: string; icon?: number; iconRotate?: string }> = [];
    const placedPills: Array<any> = [];
    const minCardDist = 18; // percent units
    const minItemDist = 7; // percent units between any two items

    function isFarEnough(x: number, y: number, others: Array<{ x: number; y: number }>, minD: number) {
      return others.every((o) => {
        const dx = o.x - x;
        const dy = o.y - y;
        return Math.sqrt(dx * dx + dy * dy) >= minD;
      });
    }

    // place cards first
    EXAMPLES.forEach((ex) => {
      let tries = 0;
      while (tries < 60) {
        tries++;
        const x = 6 + Math.random() * 88; // keep 6% padding
        const y = 6 + Math.random() * 88;
        if (isFarEnough(x, y, placedCards.map((c) => ({ x: c.x, y: c.y })), minCardDist)) {
          placedCards.push({ id: ex.id, x, y, rotate: `${Math.round((Math.random() * 30) - 15)}deg`, iconRotate: `${Math.round(Math.random() * 60 - 30)}deg` });
          break;
        }
      }
      if (tries >= 60) {
        // fallback: place evenly
        const idx = placedCards.length;
        const angle = (idx / EXAMPLES.length) * Math.PI * 2;
        placedCards.push({ id: ex.id, x: 50 + Math.cos(angle) * 30, y: 50 + Math.sin(angle) * 30, rotate: `${Math.round((Math.random() * 30) - 15)}deg`, iconRotate: `${Math.round(Math.random() * 60 - 30)}deg` });
      }
    });

    // Now place pills globally, avoiding overlap with cards and other pills
    EXAMPLES.forEach((ex) => {
      // build items with a source so we can treat allergens specially
      const rawItems: Array<{ labelRaw: string; type: 'additive' | 'preservative' | 'allergen' }> = [
        ...(ex.additives ?? []).map((s) => ({ labelRaw: s, type: 'additive' as const })),
        ...(ex.preservatives ?? []).map((s) => ({ labelRaw: s, type: 'preservative' as const })),
        ...(ex.allergens ?? []).map((s) => ({ labelRaw: s, type: 'allergen' as const })),
      ];
      rawItems.slice(0, 8).forEach((it, i) => {
        const labelRaw = it.labelRaw;
        const label = friendlyName(labelRaw);
        // compute rating and bias it toward more positive values for the decorative background
        let rawRating = additiveRatingLocal(labelRaw);
        // Allergens should remain visibly bad in the background examples
        if (it.type === 'allergen') {
          rawRating = 'bad';
        }
        // Some tokens we want to keep as visibly 'bad' for the examples — don't promote them.
        const forceKeepBadRe = /(nitrite|nitrate|nitros|bht|bha|e250|e211|e320|e321|e621)/i;
        if (forceKeepBadRe.test(String(labelRaw))) {
          rawRating = 'bad';
        } else if (it.type !== 'allergen') {
          // promote some 'bad' -> 'ok' and some 'ok' -> 'good' to make examples more positive
          if (rawRating === 'bad' && Math.random() < 0.7) rawRating = 'ok';
          if (rawRating === 'ok' && Math.random() < 0.45) rawRating = 'good';
        }
        const score = mapRatingToScore(rawRating);
        let tries = 0;
        while (tries < 80) {
          tries++;
          const x = 4 + Math.random() * 92;
          const y = 4 + Math.random() * 92;
          // ensure not too close to any card or pill
          const others = [
            ...placedCards.map((c) => ({ x: c.x, y: c.y })),
            ...placedPills.map((p) => ({ x: p.x, y: p.y })),
          ];
          if (isFarEnough(x, y, others, minItemDist)) {
            placedPills.push({ key: `${ex.id}-pill-${i}`, x, y, label, score, rotate: `${Math.round(Math.random() * 60 - 30)}deg`, iconRotate: `${Math.round(Math.random() * 60 - 30)}deg`, type: it.type });
            break;
          }
        }
        if (tries >= 80) {
          // fallback place near its card
          const card = placedCards.find((c) => c.id === ex.id)!;
          const angle = (i / Math.max(1, rawItems.length)) * Math.PI * 2;
          const radius = 20;
          placedPills.push({ key: `${ex.id}-pill-${i}`, x: card.x + Math.cos(angle) * radius, y: card.y + Math.sin(angle) * radius, label, score, rotate: `${Math.round(Math.random() * 60 - 30)}deg`, iconRotate: `${Math.round(Math.random() * 60 - 30)}deg`, type: it.type });
        }
      });
    });

    // store layouts as percent strings
    const cardsMap: Record<string, { top: string; left: string; rotate: string; iconRotate?: string }> = {};
    placedCards.forEach((c) => (cardsMap[c.id] = { top: `${c.y}%`, left: `${c.x}%`, rotate: c.rotate, iconRotate: c.iconRotate }));
    setCardLayout(cardsMap);
    // Nudge specific pill labels slightly so they don't overlap or sit undesirably
    const nudged = placedPills.map((p) => {
      let x = p.x;
      let y = p.y;
      const label = String(p.label || '').toLowerCase();
      if (label.includes('sodium benzoate') || label.includes('benzoate')) {
        // move sodium benzoate slightly down-right
        y = Math.min(96, y + 4);
        x = Math.min(96, x + 3);
      }
      if (label.includes('ascorbic')) {
        // move ascorbic acid slightly down-left
        y = Math.min(96, y + 4);
        x = Math.max(4, x - 3);
      }
      return { ...p, top: `${y}%`, left: `${x}%` };
    });
    // Ensure at least two allergens are visible in the decorative background.
    const allergenCount = nudged.filter((p) => p.type === 'allergen').length;
    if (allergenCount < 2) {
      const needed = 2 - allergenCount;
      const extras: any[] = [];
      // find examples with allergens and create forced pills near their card
      for (const ex of EXAMPLES) {
        if (extras.length >= needed) break;
        const al = (ex.allergens ?? [])[0];
        if (!al) continue;
        const card = placedCards.find((c) => c.id === ex.id) || { x: 50, y: 50 };
        // try a few positions around the card and pick one that doesn't overlap
        let placed = false;
        for (let attempt = 0; attempt < 40 && !placed; attempt++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 8 + Math.random() * 12; // 8-20 percent away
          const ox = card.x + Math.cos(angle) * radius;
          const oy = card.y + Math.sin(angle) * radius;
          const others = [
            ...placedCards.map((c) => ({ x: c.x, y: c.y })),
            ...placedPills.map((p) => ({ x: p.x, y: p.y })),
            ...extras.map((e) => ({ x: e.x, y: e.y })),
          ];
          if (isFarEnough(ox, oy, others, minItemDist)) {
            extras.push({ key: `forced-allergen-${ex.id}`, x: ox, y: oy, label: friendlyName(al), score: mapRatingToScore('bad'), rotate: '0deg', type: 'allergen', top: `${Math.max(4, Math.min(96, oy))}%`, left: `${Math.max(4, Math.min(96, ox))}%` });
            placed = true;
            break;
          }
        }
        if (!placed) {
          // fallback close to card even if overlapping slightly
          const ox = card.x + 10;
          const oy = card.y + 10;
          extras.push({ key: `forced-allergen-${ex.id}`, x: ox, y: oy, label: friendlyName(al), score: mapRatingToScore('bad'), rotate: '0deg', type: 'allergen', top: `${Math.max(4, Math.min(96, oy))}%`, left: `${Math.max(4, Math.min(96, ox))}%` });
        }
      }
      setGlobalPills([...nudged, ...extras]);
    } else {
      setGlobalPills(nudged);
    }
  }, []);

  function friendlyName(token: string) {
    if (!token) return token;
    const t = String(token).trim();
    // match E numbers like E300, E150a, case-insensitive
    const m = t.match(/^(e[0-9]{2,3}[a-z]?)$/i);
    if (m) {
      const key = m[1].toUpperCase();
      return (ENUMS as Record<string, string>)[key] ?? key;
    }
    return t;
  }

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className ?? ''} z-10 hidden sm:block`} aria-hidden>
      {EXAMPLES.map((ex) => {
        const pos = cardLayout[ex.id] ?? { top: ex.top, left: ex.left, rotate: ex.rotate ?? '0deg' };
        return (
          <div
            key={ex.id}
            className="absolute transform-gpu rounded-2xl bg-transparent p-3"
            style={{ top: pos.top, left: pos.left, minWidth: ex.size ? ex.size * 2.8 : 160, transform: `translate(-50%, -50%) rotate(${pos.rotate})`, pointerEvents: 'none' }}
          >
            <div className="relative flex items-center gap-3" style={{ minWidth: ex.size ?? 64, minHeight: ex.size ?? 64 }}>
              <div className="flex-shrink-0" style={{ width: ex.size ?? 64 }}>
                <CircularScore score={ex.score} size={ex.size ?? 64} stroke={6} />
              </div>

              <div className="flex flex-col gap-1">
                {/* overall rating label removed — the circular score shows the value */}
              </div>

              {/* optional icon on the card */}
              {/* card icon based on overall rating */}
              {(() => {
                const idxIcon = ex.score >= 75 ? 'good' : ex.score >= 45 ? 'ok' : 'bad';
                const IconComp = idxIcon === 'good' ? LuBadgeCheck : idxIcon === 'ok' ? LuBadgeMinus : LuBadgeInfo;
                const iconClass = `${ratingTextColor(ex.score)} absolute -top-2 -right-2 w-5 h-5`;
                return <IconComp className={iconClass} style={{ transform: `rotate(${cardLayout[ex.id]?.iconRotate ?? '0deg'})` }} />;
              })()}

              {/* (pills rendered globally below) */}
            </div>
          </div>
        );
      })}

      {/* Render all pills positioned across the viewport so they don't cluster */}
      {globalPills.map((pill) => (
        (() => {
          const isAllergen = pill.type === 'allergen';
          const IconComp = isAllergen ? LuBadgeHelp : (pill.score >= 75 ? LuBadgeCheck : pill.score >= 45 ? LuBadgeMinus : LuBadgeInfo);
          const baseClass = isAllergen
            ? 'absolute whitespace-nowrap text-[10px] font-semibold px-2 py-0.5 border rounded-full inline-flex items-center gap-2 bg-yellow-50 border-yellow-500 text-yellow-800 dark:bg-yellow-900/40 dark:border-yellow-400 dark:text-yellow-200'
            : `absolute whitespace-nowrap text-[10px] font-medium px-2 py-0.5 border rounded-full inline-flex items-center gap-2 ${ratingColor(pill.score)} ${ratingTextColor(pill.score)}`;
          return (
            <div
              key={pill.key}
              className={baseClass}
              style={{ top: pill.top, left: pill.left, transform: `translate(-50%, -50%) rotate(${pill.rotate})`, pointerEvents: 'none' }}
            >
              <span className="leading-none">{pill.label}</span>
              <IconComp className={`${isAllergen ? 'text-yellow-700 dark:text-yellow-200' : ratingTextColor(pill.score)} ml-1 w-4 h-4`} />
            </div>
          );
        })()
      ))}
    </div>
  );
}
