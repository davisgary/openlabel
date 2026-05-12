// Pure helpers and ZXing/server decode shared by the Scan UI
export const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf'];

export function formatNutrient(val: any, key?: string): string {
  if (val == null) return 'N/A';
  const num = typeof val === 'number' ? val : Number(String(val).replace(/,/g, '.'));
  if (!Number.isFinite(num)) return String(val);
  if (key && /energy|kcal/i.test(key)) return String(Math.round(num));
  return num.toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '');
}

export function nutrientLabel(key: string): string {
  const map: Record<string, string> = {
    energy_kcal: 'Calories', energy_kj: 'Energy (kJ)',
    fat: 'Fat', saturated_fat: 'Saturated fat', trans_fat: 'Trans fat',
    monounsaturated_fat: 'Monounsaturated fat', polyunsaturated_fat: 'Polyunsaturated fat',
    cholesterol: 'Cholesterol', carbohydrates: 'Carbohydrates',
    sugars: 'Sugars', fiber: 'Fiber', proteins: 'Protein',
    salt: 'Salt', sodium: 'Sodium',
  };
  return map[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function renderNutrientDisplay(
  key: string,
  v: { value: number | null; unit: string | null } | null,
): string {
  if (!v) return 'N/A';
  let { value: val, unit } = v;
  if (key === 'sodium' && val != null && unit && /^g$/i.test(unit)) {
    val = val * 1000;
    unit = 'mg';
  }
  if (val == null) return 'N/A';
  const formatted = formatNutrient(val, key);
  return key === 'energy_kcal' ? formatted : formatted + (unit ? ' ' + unit : '');
}

export function mapRatingToScore(r: any): number {
  if (r == null) return 0;
  if (typeof r === 'number' && Number.isFinite(r)) return Math.max(0, Math.min(100, Math.round(r)));
  const s = String(r).trim().toLowerCase();
  if (s === 'good') return 90;
  if (s === 'ok' || s === 'okay' || s === 'neutral') return 60;
  if (s === 'bad' || s === 'poor') return 20;
  const n = Number(s.replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

export function ratingLabel(score: number) {
  if (score >= 75) return 'Good';
  if (score >= 45) return 'Ok';
  return 'Bad';
}

export function ratingColor(score: number) {
  if (score >= 75) return 'border-good/60';
  if (score >= 45) return 'border-ok/60';
  return 'border-bad/60';
}

export function ratingStroke(score: number) {
  if (score >= 75) return 'text-good';
  if (score >= 45) return 'text-ok';
  return 'text-bad';
}

export function ratingTextColor(score: number): string {
  if (score >= 75) return 'text-good';
  if (score >= 45) return 'text-ok';
  return 'text-bad';
}

// Load configurable rules from lib/additive-rules.json when available. The file should
// export an object with arrays: { good: string[], ok: string[], bad: string[] }
let _goodRe = /(ascorbic|citric|tocopherol|vitamin|malic|riboflavin|beetroot|carotene|annatto|paprika|lycopene|anthocyanin|chlorophyll)/i;
let _okRe = /(sorbate|benzoate|propionat|propionic|sulfite|sulphite|edta|lecithin|xanthan|guar|carrageen|pectin|starch|monoglyceride|diglyceride)/i;
let _badRe = /(nitrite|nitrate|nitros|bht|bha|e320|e321|tartrazin|sunset.?yellow|azorubine|allura|ponceau|e102|e104|e110|e122|e123|e124|e129|e150[bcd]|e211|e250|e251|e310|e311|e312|e621|monosodium.?glutamate|\bmsg\b|acesulfame|saccharin|cyclamate|aspartame|sodium.?benzoate|potassium.?benzoate|calcium.?benzoate)/i;

try {
  // Dynamic import to avoid bundling issues; falling back if the JSON isn't present
  // Note: TypeScript/Next supports importing JSON files directly.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rules = require('../../lib/additive-rules.json');
  if (rules) {
    const makeRe = (arr: any[]) => {
      if (!Array.isArray(arr) || arr.length === 0) return null;
      // escape tokens and join with alternation
      const tokens = arr.map((s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      return new RegExp('(' + tokens.join('|') + ')', 'i');
    };
    const g = makeRe(rules.good);
    const o = makeRe(rules.ok);
    const b = makeRe(rules.bad);
    if (g) _goodRe = g;
    if (o) _okRe = o;
    if (b) _badRe = b;
  }
} catch (e) {
  // ignore — fall back to built-in regexes
}

/** Rate a plain additive string as 'good' | 'ok' | 'bad' using ingredient signal words */
export function additiveRating(name: string): 'good' | 'ok' | 'bad' {
  const n = String(name || '').trim();
  if (_badRe.test(n)) return 'bad';
  if (_okRe.test(n)) return 'ok';
  if (_goodRe.test(n)) return 'good';
  return 'ok'; // neutral default
}

/** Grab one frame from a playing video into a canvas at native resolution. */
export function captureFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  const { videoWidth: w, videoHeight: h } = video;
  if (!w || !h || video.readyState < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d', { willReadFrequently: true })?.drawImage(video, 0, 0, w, h);
  return canvas;
}

// Lazily-initialised ZXing reader — created once and reused for all decodes
let _zxReaderPromise: Promise<{
  decode: (canvas: HTMLCanvasElement) => string | null;
}> | null = null;

export function getZxReader() {
  if (!_zxReaderPromise) {
    _zxReaderPromise = import('@zxing/library').then(
      ({ BinaryBitmap, HybridBinarizer, MultiFormatReader, DecodeHintType, BarcodeFormat, HTMLCanvasElementLuminanceSource }) => {
        const reader = new MultiFormatReader();
        const hints = new Map<any, any>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        reader.setHints(hints);
        return {
          decode(canvas: HTMLCanvasElement): string | null {
            try {
              const result = reader.decode(
                new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(canvas))),
              );
              return (typeof result?.getText === 'function' ? result.getText() : null) || null;
            } catch {
              return null;
            }
          },
        };
      },
    );
  }
  return _zxReaderPromise;
}

/** Client-side ZXing decode on a canvas. Returns text or null. */
export async function zxingDecode(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const zx = await getZxReader();
    return zx.decode(canvas);
  } catch {
    return null;
  }
}

/** Server-side decode via /api/decode. Returns barcode text or null. */
export async function serverDecode(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    // Quality 0.7 is plenty for barcode recognition and keeps the payload small (~30-50KB)
    const image = canvas.toDataURL('image/jpeg', 0.7);
    const res = await fetch('/api/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const p = await res.json().catch(() => null);
    return p?.text ?? null;
  } catch {
    return null;
  }
}
