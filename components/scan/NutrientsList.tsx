'use client';
import React from 'react';
import { nutrientLabel, renderNutrientDisplay } from './utils';

// Thresholds per 100g for colour-coding (mirrors Yuka / traffic-light labelling)
const HIGH_THRESHOLDS: Record<string, number> = {
  saturated_fat: 5,    // g — "high" above 5g/100g
  sugars: 12.5,        // g — "high" above 12.5g/100g
  sodium: 0.6,         // g — "high" above 0.6g/100g (600mg)
  salt: 1.5,           // g — "high" above 1.5g/100g
  trans_fat: 0.2,      // g — any meaningful trans fat
};
const MEDIUM_THRESHOLDS: Record<string, number> = {
  saturated_fat: 2.5,
  sugars: 5,
  sodium: 0.3,
  salt: 0.75,
};

export default function NutrientsList({ product }: { product: any }) {
  if (!product) return null;

  // Also grab per-100g values for threshold colouring
  const detailed100 = product.nutrients_detailed || {};

  const keys = Array.from(new Set([
    ...(product.nutrients_per_serving ? Object.keys(product.nutrients_per_serving) : []),
    ...(product.nutrients_detailed ? Object.keys(product.nutrients_detailed) : []),
  ])).filter((k) => k !== 'energy_kj');

  const items: Array<{ key: string; v: { value: number | null; unit: string | null } | null }> = [];
  for (const k of keys) {
    const ps = product.nutrients_per_serving?.[k];
    const pd = product.nutrients_detailed?.[k];
    let v = null as { value: number | null; unit: string | null } | null;
    if (ps && ps.value != null) {
      v = { value: ps.value, unit: ps.unit || pd?.unit || null };
    } else if (pd && pd.value != null && product.serving_size_grams != null) {
      const per100 = pd.value as number;
      const grams = product.serving_size_grams as number;
      const computed = Number.isFinite(per100) ? per100 * (grams / 100) : null;
      v = { value: computed, unit: pd.unit || null };
    }
    if (v && v.value != null) items.push({ key: k, v });
  }

  // Daily reference values used to render percent bars (same heuristics as original)
  const DAILY: Record<string, number> = {
    energy_kcal: 2000,
    carbohydrates: 275,
    fat: 70,
    saturated_fat: 20,
    sugars: 50,
    salt: 6,
    sodium: 2.4,
    proteins: 50,
    fiber: 30,
  };

  return (
    <div className="mt-3">
      <div className="text-xs font-semibold text-muted-foreground">Per serving{product.serving_size ? ` (${product.serving_size})` : ''}</div>
      <div className="my-3 space-y-3">
        {items.map(({ key, v }, i) => {
          const val = v!.value as number;
          const unit = (v!.unit || '').toString();

          // compute percent relative to DAILY if available
          let percent: number | null = null;
          if (DAILY[key]) {
            let valueInUnits = val;
            if (/mg/i.test(unit)) valueInUnits = val / 1000;
            percent = Math.round((valueInUnits / DAILY[key]) * 100);
          }

          const barWidth = percent != null ? `${Math.max(4, Math.min(100, percent))}%` : '0%';

          // Determine traffic-light level using per-100g values
          let level: 'high' | 'medium' | 'normal' = 'normal';
          const per100Entry = detailed100[key];
          const per100Val: number | null = per100Entry?.value ?? null;
          if (per100Val != null && HIGH_THRESHOLDS[key] != null) {
            // sodium stored in g, convert to g for comparison
            const cmpVal = (key === 'sodium' && per100Entry?.unit && /^mg$/i.test(per100Entry.unit))
              ? per100Val / 1000
              : per100Val;
            if (cmpVal > HIGH_THRESHOLDS[key]) level = 'high';
            else if (MEDIUM_THRESHOLDS[key] != null && cmpVal > MEDIUM_THRESHOLDS[key]) level = 'medium';
          }

          const barColor =
            level === 'high'   ? 'bg-bad' :
            level === 'medium' ? 'bg-ok'  :
            'bg-primary-foreground';

          const labelExtra =
            level === 'high'   ? <span className="ml-1 text-[10px] font-semibold text-bad uppercase tracking-wide">High</span> :
            level === 'medium' ? <span className="ml-1 text-[10px] font-semibold text-ok uppercase tracking-wide">Moderate</span> :
            null;

          return (
            <div key={key} className={`w-full ${i > 0 ? 'border-t border-muted pt-3' : ''}`}>
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-medium text-primary-foreground flex items-center">
                  {nutrientLabel(key)}{labelExtra}
                </div>
                <div className="text-sm text-primary-foreground">{renderNutrientDisplay(key, v)}</div>
              </div>
              <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  role="progressbar"
                  aria-valuenow={percent != null ? Math.max(0, Math.min(100, percent)) : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: barWidth }}
                />
              </div>
              {percent != null && (
                <div className="text-xs text-muted-foreground mt-1">{percent}% of daily reference</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
