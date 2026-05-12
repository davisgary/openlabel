'use client';
import React from 'react';
import CircularScore from './CircularScore';
import NutrientsList from './NutrientsList';
import { mapRatingToScore, ratingLabel, ratingColor, ratingTextColor, additiveRating } from './utils';
import eNumbers from '../../lib/e-numbers.json';
import { LuBadgeCheck, LuBadgeMinus, LuBadgeInfo, LuBadgeHelp } from "react-icons/lu";

const RatingIcon = ({ label, className }: { label: string; className?: string }) => {
  const normalized = label.toLowerCase();
  if (normalized === 'good') return <LuBadgeCheck className={className} />;
  if (normalized === 'ok') return <LuBadgeMinus className={className} />;
  if (normalized === 'bad') return <LuBadgeInfo className={className} />;
  return null;
};

function friendlyENumberName(raw: string | null | undefined) {
  if (!raw) return null;
  const s = String(raw).trim();

  // Strip "E450 - " or "E450: " style prefixes from AI-returned strings like "E450 - Disodium Diphosphate"
  // and return just the human-readable part after the dash/colon
  const prefixMatch = s.match(/^[Ee]\d{2,4}[a-z]?\s*[-–:]\s*(.+)$/i);
  if (prefixMatch) return prefixMatch[1].trim();

  // Try to look up a bare E-code (e.g. "E160", "E500") in the e-numbers map
  const codeMatch = s.toUpperCase().match(/^E0*(\d{2,4})[A-Z]?$/);
  if (codeMatch) {
    const key = 'E' + codeMatch[1];
    const v = (eNumbers as any)[key];
    if (v) return String(v);
    // No mapping found — return nothing so bare E-codes are hidden
    return null;
  }

  // For strings that contain an E-code embedded in parentheses e.g. "Modified Corn Starch (E1422)"
  // return the friendly part before the parenthesis
  const parenMatch = s.match(/^(.+?)\s*\([Ee]\d{2,4}[a-z]?\)\s*$/i);
  if (parenMatch) return parenMatch[1].trim();

  return s || null;
}

export default function ProductDetails({ product, onAskAI }: { product: any; onAskAI?: (query: string) => void }) {
  if (!product) return null;
  const score = mapRatingToScore(product.overall_score ?? product.overall_rating);
  const pill = ratingLabel(score);
  const pillCls = ratingColor(score);

  return (
    <div className="space-y-3">
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-4">

          <div className="flex flex-col">
            <div className="flex items-center">
              <div className="flex-shrink-0"><CircularScore score={score} size={80} stroke={8} label={pill} labelClass={pillCls} /></div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center items-center text-center">
            <h2 className="text-primary-foreground text-xl font-semibold leading-tight whitespace-normal break-words">{product.product_name || 'Unnamed product'}</h2>
            {product.brands && (
              <div className="text-sm">
                <span className="font-medium text-muted-foreground">Manufactured By: </span>
                <span
                  role="button"
                  tabIndex={0}
                  title={`Ask AI about ${product.brands}`}
                  onClick={() => onAskAI?.(`Tell me about the manufacturer ${product.brands}`)}
                  onKeyDown={(e) => { if ((e as any).key === 'Enter' || (e as any).key === ' ') { e.preventDefault(); onAskAI?.(`Tell me about the manufacturer ${product.brands}`); } }}
                  className="text-primary-foreground cursor-pointer hover:opacity-80 active:scale-95"
                >
                  {product.brands}
                </span>
              </div>
            )}
          </div>

          {product.image && (
            <img
              src={product.image}
              alt={product.brands || product.product_name || 'logo'}
              className="w-20 h-20 rounded-md object-contain bg-white p-2 flex-shrink-0 border border-muted"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
      </div>

      {product.overall_explanation && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground">Overall</div>
          <div className="text-sm mt-1 max-w-prose">{product.overall_explanation}</div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-muted-foreground">Ingredients</div>
        <div className="text-sm text-primary-foreground mt-1">{product.ingredients_text || 'N/A'}</div>
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground">Additives</div>
        <div className="mt-2">
          {product.additives && Array.isArray(product.additives) && product.additives.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {(() => {
                // Deduplicate additives by their friendly display name (case-insensitive)
                const seen = new Set<string>();
                const unique: Array<{ raw: string; display: string }> = [];
                product.additives.forEach((a: string) => {
                  const display = friendlyENumberName(a) || a;
                  const key = String(display).trim().toLowerCase();
                  if (!seen.has(key)) {
                    seen.add(key);
                    unique.push({ raw: a, display });
                  }
                });

                return unique.map(({ raw, display }) => {
                  const aRating = additiveRating(raw);
                  const aScore = mapRatingToScore(aRating);
                  const aLabel = ratingLabel(aScore);
                  const aPillCls = ratingColor(aScore);
                  const aTextCls = ratingTextColor(aScore);
                  return (
                    <div
                      key={display}
                      onClick={() => onAskAI?.(`Tell me about the additive ${display}`)}
                      className={`font-medium text-xs px-2 py-1 border rounded-full inline-flex items-center gap-1.5 transition-colors cursor-pointer hover:opacity-80 active:scale-95 ${aPillCls}`}
                    >
                      <span className="text-primary-foreground">{display}</span>
                      <RatingIcon label={aLabel} className={`w-[1.05rem] h-[1.05rem] ${aTextCls}`} />
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <span className="text-sm text-primary-foreground">None listed</span>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground mt-2">Preservatives</div>
        <div className="text-sm mt-1">
          {product.preservatives && product.preservatives.length > 0 ? (
            Array.isArray(product.preservatives) && typeof product.preservatives[0] === 'string' ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {(() => {
                  const seen = new Set<string>();
                  const unique: Array<{ raw: string; display: string }> = [];
                  product.preservatives.forEach((p: string) => {
                    const display = friendlyENumberName(p) || p;
                    const key = String(display).trim().toLowerCase();
                    if (!seen.has(key)) {
                      seen.add(key);
                      unique.push({ raw: p, display });
                    }
                  });

                  return unique.map(({ raw, display }) => {
                    const pRating = additiveRating(raw);
                    const pScore = mapRatingToScore(pRating);
                    const pLabel = ratingLabel(pScore);
                    const pPillCls = ratingColor(pScore);
                    const pTextCls = ratingTextColor(pScore);
                    return (
                      <div
                        key={display}
                        onClick={() => onAskAI?.(`Tell me about the preservative ${display}`)}
                        className={`font-medium text-xs px-2 py-1 border rounded-full inline-flex items-center gap-1.5 transition-colors cursor-pointer hover:opacity-80 active:scale-95 ${pPillCls}`}
                      >
                        <span className="text-primary-foreground">{display}</span>
                        <RatingIcon label={pLabel} className={`w-[1.05rem] h-[1.05rem] ${pTextCls}`} />
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const seen = new Set<string>();
                  const unique = product.preservatives.filter((p: any) => {
                    const key = String(p?.name || p?.code || '').trim().toLowerCase();
                    if (!key || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  return unique.map((p: any) => {
                    const display = p?.name || p?.code || '';
                    const pScore = mapRatingToScore(p?.score ?? p?.rating);
                    const pill2 = ratingLabel(pScore);
                    const pillCls2 = ratingColor(pScore);
                    const textCls2 = ratingTextColor(pScore);
                    return (
                      <div
                        key={display}
                        onClick={() => onAskAI?.(`Tell me about the preservative ${display}`)}
                        className={`font-medium text-xs px-2 py-1 border rounded-full inline-flex items-center gap-1.5 transition-colors cursor-pointer hover:opacity-80 active:scale-95 ${pillCls2}`}
                      >
                        <span className="text-primary-foreground">{display}</span>
                        <RatingIcon label={pill2} className={`w-[1.05rem] h-[1.05rem] ${textCls2}`} />
                      </div>
                    );
                  });
                })()}
              </div>
            )
          ) : (
            <span className="text-sm text-primary-foreground">None listed</span>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground mt-2">Allergens</div>
        <div className="mt-1 flex flex-wrap gap-2">
          {(() => {
            const raw = product.allergens;
            let parts: string[] = [];
            if (Array.isArray(raw)) parts = raw.map(String);
            else if (typeof raw === 'string' && raw.trim()) parts = raw.split(/[,;\/]+/).map((s) => s.trim()).filter(Boolean);
            const cleaned = parts.map((p) => {
              const noLang = String(p).replace(/^[a-z]{2}:/i, '').trim();
              return noLang.length > 0 ? noLang.charAt(0).toUpperCase() + noLang.slice(1) : noLang;
            }).filter(Boolean);
            if (cleaned.length === 0) return <div className="text-sm text-primary-foreground">None listed</div>;
            return cleaned.map((a) => (
              <div 
                key={a} 
                onClick={() => onAskAI?.(`Tell me more about ${a} as an allergen`)}
                className="font-medium text-xs px-2 py-1 text-primary-foreground border border-allergen/60 rounded-full inline-flex items-center gap-1.5 transition-colors cursor-pointer hover:opacity-80 active:scale-95"
              >
                <span>{a}</span>
                <LuBadgeHelp className="w-[1.05rem] h-[1.05rem] text-allergen" />
              </div>
            ));
          })()}
        </div>
      </div>

      <NutrientsList product={product} />
    </div>
  );
}
