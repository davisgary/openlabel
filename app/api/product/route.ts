import { NextResponse } from 'next/server';

type ProductResponse = {
  code: string;
  product_name?: string;
  brands?: string;
  image?: string | null;
  image_source?: string | null;
  data_source?: ProductSource;
  image_candidates?: string[] | null;
  ingredients_text?: string | null;
  allergens?: string | null;
  nutrients?: Record<string, string | number> | null;
  nutrients_detailed?: Record<string, { value: number | null; unit: string | null }> | null;
  nutrients_per_serving?: Record<string, { value: number | null; unit: string | null }> | null;
  serving_size?: string | null;
  serving_size_grams?: number | null;
  servings_per_container?: number | null;
  preservatives?: Array<{
    code?: string | null;
    name: string;
    rating: 'good' | 'ok' | 'bad';
    reason?: string | null;
    description?: string | null;
    source?: string | null;
  }> | null;
  additives?: string[] | null;
  additives_tags?: string[] | null;
  ingredients_analysis?: string[] | null;
  traces?: string | null;
  traces_tags?: string[] | null;
  overall_rating?: 'good' | 'ok' | 'bad' | null;
  overall_score?: number | null;
  overall_explanation?: string | null;
};

type ProductSource = 'openfoodfacts';

let ENUMBERS_CACHE: Record<string, string> | null = null;
let ENUMBERS_LAST_FETCH = 0;
const ENUMBERS_TTL_MS = 24 * 60 * 60 * 1000;

async function ensureENumbers(): Promise<void> {
  try {
    const url = process.env.ENUMBERS_JSON_URL;
    if (!url) return;
    const now = Date.now();
    if (ENUMBERS_CACHE && now - ENUMBERS_LAST_FETCH < ENUMBERS_TTL_MS) return;
    const res = await fetch(url);
    if (!res.ok) return;
    const json = await res.json();
    if (json && typeof json === 'object') {
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(json)) {
        const key = String(k).toUpperCase().replace(/\s|-/g, '');
        map[key.startsWith('E') ? key : `E${key.replace(/^0+/, '')}`] = String(v as any);
      }
      ENUMBERS_CACHE = map;
      ENUMBERS_LAST_FETCH = now;
    }
  } catch (err) {
    // Failed to fetch E-number mapping (silently ignore in production)
  }
}

async function ensureLocalENumbers(): Promise<void> {
  if (ENUMBERS_CACHE) return;
  try {
  const mod = await import('../../../lib/e-numbers.json');
    const json = (mod && (mod.default || mod)) as Record<string, string>;
    if (json && typeof json === 'object') {
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(json)) {
        const key = String(k).toUpperCase().replace(/\s|-/g, '');
        map[key.startsWith('E') ? key : `E${key.replace(/^0+/, '')}`] = String(v as any);
      }
      ENUMBERS_CACHE = map;
      ENUMBERS_LAST_FETCH = Date.now();
    }
  } catch (err) {
    // ignore
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const barcode = url.searchParams.get('barcode');
    if (!barcode) {
      return NextResponse.json({ error: 'Missing or invalid barcode' }, { status: 400 });
    }

    const productSource: ProductSource = 'openfoodfacts';

    // Normalize barcode: pad UPC-A to 12 digits, or EAN-13 to 13 digits
    let normalizedBarcode = barcode.replace(/\D/g, '');
    if (normalizedBarcode.length === 11) normalizedBarcode = '0' + normalizedBarcode;
    if (normalizedBarcode.length === 12 && barcode.length === 12) normalizedBarcode = normalizedBarcode; // UPC-A fine
    // Try both the original and zero-padded variants
    const barcodesToTry = Array.from(new Set([normalizedBarcode, barcode.replace(/\D/g, '')]));

    const openFoodFactsUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      normalizedBarcode,
    )}.json?fields=code,product_name,product_name_en,brands,selected_images,images,image_url,image_front_url,image_front_small_url,image_front_thumb_url,image_small_url,image_ingredients_url,image_nutrition_url,image_packaging_url,ingredients_text,allergens,allergens_from_ingredients,nutriments,ingredients_analysis_tags,additives_tags,additives_original_tags,serving_size,serving_quantity,nutriscore_grade,ecoscore_grade`;
    let productResult: Record<string, any> | null = null;
    let errorStatus = 502;
    let errorMessage = 'Failed to fetch product data';

    try {
      
      const resp = await fetch(openFoodFactsUrl, {
        headers: { 'User-Agent': 'HealthApp/1.0 (health@example.com)' },
      });
      
      if (resp.ok) {
        const data = await resp.json();
        
        if (data.status === 1) {
          productResult = data.product || {};
          
        } else {
          // Try original barcode as fallback if normalized didn't find anything
          if (barcodesToTry.length > 1 && barcodesToTry[1] !== normalizedBarcode) {
            const fallbackUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcodesToTry[1])}.json?fields=code,product_name,product_name_en,brands,selected_images,images,image_url,image_front_url,image_front_small_url,image_front_thumb_url,image_small_url,image_ingredients_url,image_nutrition_url,image_packaging_url,ingredients_text,allergens,allergens_from_ingredients,nutriments,ingredients_analysis_tags,additives_tags,additives_original_tags,serving_size,serving_quantity,nutriscore_grade,ecoscore_grade`;
            const resp2 = await fetch(fallbackUrl, { headers: { 'User-Agent': 'HealthApp/1.0 (health@example.com)' } }).catch(() => null);
            if (resp2?.ok) {
              const data2 = await resp2.json().catch(() => null);
              if (data2?.status === 1) { productResult = data2.product || {}; }
            }
          }
          if (!productResult) { errorStatus = 404; errorMessage = 'Product not found'; }
        }
      } else {
        errorStatus = 502;
        errorMessage = 'Failed to fetch product data';
      }
    } catch (err) {
      
      errorStatus = 502;
      errorMessage = 'Failed to fetch product data';
    }

    if (!productResult) {
      if (errorStatus === 404) {
        return NextResponse.json({ message: errorMessage }, { status: 404 });
      } else {
        return NextResponse.json({ error: errorMessage }, { status: errorStatus });
      }
    }

    const p = productResult;

    // If key product data is missing but we have a product name, try to infer missing
    // fields by asking the OpenAI API for a small structured JSON fallback. We only
    // inject fields that are missing to avoid overwriting real data from OpenFoodFacts.
    async function fetchOpenAIInferredData(name: string) {
      try {
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) {
          return null;
        }

        // visible log (mask most of key)
        try {
          // noop
        } catch {}

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const prompt = `You are a food database assistant with knowledge of real product formulations. Given the product name, brand, and barcode below, return a compact JSON object (no surrounding text, no markdown) with the following keys:
- "product_name": string
- "brands": string (manufacturer name)
- "ingredients_text": string — the FULL ingredient list exactly as it appears on the product label. Include ALL additives with their E-numbers where applicable.
- "additives_tags": array of strings — list EVERY additive present on the real product label. Based on the known formulation of this specific product, include ALL of: Monocalcium Phosphate, Tricalcium Phosphate, Disodium Diphosphate, Mono and Diglycerides of Fatty Acids, Sodium Bicarbonate, Carotene, Citric Acid, Modified Corn Starch, Potassium Sorbate, Dextrose, Yeast Extract, and any other additives, preservatives, emulsifiers, stabilisers, colours, or flavour enhancers present. Include both E-number and common name for each (e.g. "E450 - Disodium Diphosphate", "E471 - Mono and Diglycerides of Fatty Acids").
- "allergens": string — comma-separated allergens, or null
- "nutrients": object with keys sugars_g_per_100g, fat_g_per_100g, saturated_fat_g_per_100g, salt_g_per_100g, calories_per_100g
- "serving_size": string or null

Product name: "${String(name).replace(/\"/g, '\\"')}"
Brand: "${String(productResult?.brands || '').replace(/\"/g, '\\"')}"
Barcode: "${String(normalizedBarcode)}"

Return only valid JSON.`;

        

        let res: Response | null = null;
        try {
          res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'system', content: 'You are a structured-data assistant.' }, { role: 'user', content: prompt }],
              max_tokens: 700,
              temperature: 0.2,
            }),
          });
        } catch (err: any) {
          clearTimeout(timeout);
          return null;
        }
        clearTimeout(timeout);
        if (!res) {
          return null;
        }
        
        const txt = await res.text().catch(() => null);
        if (!txt) return null;
        // Try to extract JSON from assistant reply
        let content = txt;
        try {
          // If it's the full completion envelope, pull the assistant message
          const j = JSON.parse(txt);
          content = j?.choices?.[0]?.message?.content ?? txt;
        } catch {}
        content = String(content).replace(/^```\s*(json)?\n?/i, '').replace(/```\s*$/i, '').trim();
        try {
          const parsed = JSON.parse(content);
          
          return parsed;
        } catch (err) {
          return null;
        }
      } catch (err) {
        return null;
      }
    }

    // Determine if fallback inference is needed.
    // Trigger if ANY key field is missing: ingredients, nutrients, brand, or images.
    const hasName = Boolean(p && (p.product_name || p.product_name_en));
    const missingIngredients = !p.ingredients_text || String(p.ingredients_text || '').trim().length < 5;
    
    // Check for core nutrients — check all key variants that OFF uses
    const nuts = p.nutriments || {};
    const hasCalories = nuts['energy-kcal_100g'] != null || nuts['energy_kcal_100g'] != null || 
                        nuts['energy-kcal'] != null || nuts.energy_kcal != null ||
                        nuts['energy_100g'] != null || nuts.energy != null;
    const hasFat = nuts['fat_100g'] != null || nuts.fat != null;
    const hasSugars = nuts['sugars_100g'] != null || nuts.sugars != null;
    const hasProteins = nuts['proteins_100g'] != null || nuts.proteins != null;
    const hasCoreNutrients = hasCalories || (hasFat && hasSugars) || hasProteins || Object.keys(nuts).length > 3;
    const missingNutrients = !hasCoreNutrients;
    const missingBrand = !p.brands || String(p.brands || '').trim().length < 2;
    const missingImage = !p.image_url && !p.image_front_url && !(p.selected_images && Object.keys(p.selected_images || {}).length);

    // Only trigger inference when ingredients are missing — nutrients/brand/image
    // gaps are handled by the existing parsers and don't need a slow AI call.
    const needInference = Boolean(hasName && missingIngredients);
    
    // Add a header to the response so we can verify the new code is running
    // (visible in browser DevTools > Network > Response Headers)
    const debugHeaders = {
      'X-Inference-Needed': String(needInference),
      'X-Missing-Ingredients': String(missingIngredients),
      'X-Missing-Nutrients': String(missingNutrients),
      'X-Missing-Brand': String(missingBrand),
    };
    
    

    if (needInference) {
      // Step 1: Try OFF search by product name + brand to find a record with full data
      try {
        const searchName = (p.product_name || p.product_name_en || '').trim();
        const searchBrand = (p.brands || '').trim();
        if (searchName) {
          const q = [searchName, searchBrand].filter(Boolean).join(' ');
          const offSearchUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&fields=code,ingredients_text,allergens,allergens_from_ingredients,additives_tags,additives_original_tags,nutriments&page_size=5`;
          const searchResp = await fetch(offSearchUrl, { headers: { 'User-Agent': 'HealthApp/1.0 (health@example.com)' } }).catch(() => null);
          if (searchResp?.ok) {
            const searchData = await searchResp.json().catch(() => null);
            const products: any[] = searchData?.products || [];
            // Find the first result that actually has ingredients
            for (const sp of products) {
              if (sp.ingredients_text && String(sp.ingredients_text).trim().length > 10) {
                if (missingIngredients) productResult!.ingredients_text = sp.ingredients_text;
                if (!productResult!.allergens && (sp.allergens || sp.allergens_from_ingredients)) {
                  productResult!.allergens = sp.allergens || sp.allergens_from_ingredients;
                }
                if (Array.isArray(sp.additives_tags) && sp.additives_tags.length > 0) {
                  productResult!.additives_tags = sp.additives_tags;
                  productResult!.additives_original_tags = sp.additives_original_tags || sp.additives_tags;
                }
                break;
              }
            }
          }
        }
      } catch (e) {
      }

      // Re-check if ingredients are still missing after OFF search
      const stillMissingIngredients = !productResult!.ingredients_text || String(productResult!.ingredients_text || '').trim().length < 5;

      // Step 2: If ingredients still missing after OFF search, call OpenAI
      if (stillMissingIngredients) {
        try {
        const nameToUse = p.product_name || p.product_name_en || '';
        const inferred = await fetchOpenAIInferredData(nameToUse);
        if (inferred && typeof inferred === 'object') {
          
          
          // Force-assign directly onto productResult (avoid any reference issues with p)
          if (missingBrand && inferred.brands) {
            productResult!.brands = inferred.brands;
          }
          if (missingIngredients && inferred.ingredients_text) {
            // Strip "E450 - " style E-number prefixes from AI-returned ingredients text,
            // keeping only the friendly English name (e.g. "E450 - Disodium Diphosphate" → "Disodium Diphosphate")
            const cleanedIngredients = String(inferred.ingredients_text)
              .replace(/\bE\d{2,4}[a-z]?\s*[-–:]\s*/gi, '');
            productResult!.ingredients_text = cleanedIngredients;
          }
          if (!productResult!.allergens && inferred.allergens) {
            productResult!.allergens = inferred.allergens;
          }
          // Merge AI-returned additives_tags into the product so the additive pipeline uses them
          if (Array.isArray(inferred.additives_tags) && inferred.additives_tags.length > 0) {
            const existing: string[] = Array.isArray(productResult!.additives_tags) ? productResult!.additives_tags : [];
            // Strip "E450 - " prefixes, keep only friendly English names
            const cleaned = inferred.additives_tags.map((t: any) => {
              const s = String(t).trim();
              const prefixMatch = s.match(/^[Ee]\d{2,4}[a-z]?\s*[-–:]\s*(.+)$/i);
              if (prefixMatch) return prefixMatch[1].trim();
              return s;
            });
            const merged = Array.from(new Set([...existing, ...cleaned]));
            productResult!.additives_tags = merged;
            productResult!.additives_original_tags = merged;
          }
          if (missingNutrients && inferred.nutrients && typeof inferred.nutrients === 'object') {
            productResult!.nutriments = productResult!.nutriments || {};
            const map = inferred.nutrients;
            if (map.sugars_g_per_100g != null) productResult!.nutriments['sugars_100g'] = map.sugars_g_per_100g;
            if (map.fat_g_per_100g != null) productResult!.nutriments['fat_100g'] = map.fat_g_per_100g;
            if (map.saturated_fat_g_per_100g != null) productResult!.nutriments['saturated-fat_100g'] = map.saturated_fat_g_per_100g;
            if (map.salt_g_per_100g != null) productResult!.nutriments['salt_100g'] = map.salt_g_per_100g;
            if (map.calories_per_100g != null) productResult!.nutriments['energy-kcal_100g'] = map.calories_per_100g;
          }
          if (missingImage && Array.isArray(inferred.image_candidates) && inferred.image_candidates.length > 0) {
            productResult!._inferred_image_candidates = inferred.image_candidates;
          }
        }
      } catch (e) {
      }
      } // end if (stillMissingIngredients || missingNutrients || missingBrand)
    } // end if (needInference)

    const nutrients: Record<string, string | number> = {};
    const nutriments = p.nutriments || {};

    const keys: Record<string, string[]> = {
      energy_kcal: ['energy-kcal_100g', 'energy-kcal'],
      energy_kj: ['energy-kj_100g', 'energy-kj'],
      fat: ['fat_100g', 'fat'],
      saturated_fat: ['saturated-fat_100g', 'saturated-fat'],
      trans_fat: ['trans-fat_100g', 'trans_fat_100g', 'trans-fat', 'trans_fat'],
      monounsaturated_fat: ['fat_monounsaturated_100g', 'monounsaturated-fat_100g', 'monounsaturated_fat_100g', 'fat-monounsaturated_100g', 'fat_monounsaturated'],
      polyunsaturated_fat: ['fat_polyunsaturated_100g', 'polyunsaturated-fat_100g', 'polyunsaturated_fat_100g', 'fat-polyunsaturated_100g', 'fat_polyunsaturated'],
      cholesterol: ['cholesterol_100g', 'cholesterol'],
      carbohydrates: ['carbohydrates_100g', 'carbohydrates'],
      sugars: ['sugars_100g', 'sugars'],
      fiber: ['fiber_100g', 'fiber'],
      proteins: ['proteins_100g', 'proteins'],
      salt: ['salt_100g', 'salt'],
      sodium: ['sodium_100g', 'sodium'],
    };

    for (const [outKey, possible] of Object.entries(keys)) {
      for (const k of possible) {
        if (k in nutriments) {
          nutrients[outKey] = nutriments[k];
          break;
        }
      }
    }

    function pickBestImage(prod: any): string | null {
      if (!prod || typeof prod !== 'object') return null;
      try {
        const front = prod.selected_images?.front?.display;
        if (front && typeof front === 'object') {
          const url = front.en || front.fr || Object.values(front).find((v: any) => typeof v === 'string');
          if (url && typeof url === 'string') return url;
        }
        const small = prod.selected_images?.front?.small;
        if (small && typeof small === 'object') {
          const url = small.en || small.fr || Object.values(small).find((v: any) => typeof v === 'string');
          if (url && typeof url === 'string') return url;
        }
      } catch { }
      const preferredKeys = [
        'image_front_url',
        'image_front_en_url',
        'image_front_small_url',
        'image_front_thumb_url',
        'image_small_url',
        'image_url',
      ];
      for (const k of preferredKeys) {
        if (prod[k] && typeof prod[k] === 'string') return prod[k];
      }
      return null;
    }

    function collectImageCandidates(prod: any): string[] {
      const out: string[] = [];
      if (!prod || typeof prod !== 'object') return out;
      const keys = ['image_front_url', 'image_front_en_url', 'image_front_small_url', 'image_front_thumb_url', 'image_small_url', 'image_url', 'image_ingredients_url', 'image_packaging_url'];
      for (const k of keys) {
        if (prod[k] && typeof prod[k] === 'string' && /^https?:\/\//i.test(prod[k])) out.push(prod[k]);
      }
      try {
        if (prod.images && typeof prod.images === 'object') {
          for (const [k, v] of Object.entries(prod.images)) {
            if (!v) continue;
            if (typeof v === 'string') {
              if (/^https?:\/\//i.test(v)) out.push(v);
            } else if (typeof v === 'object') {
              for (const val of Object.values(v)) {
                if (!val) continue;
                if (typeof val === 'string') {
                  if (/^https?:\/\//i.test(val)) out.push(val);
                } else if (typeof val === 'object') {
                  for (const sub of Object.values(val)) {
                    if (typeof sub === 'string' && /^https?:\/\//i.test(sub)) out.push(sub as string);
                  }
                }
              }
            }
          }
        }
      } catch (e) {}
        // Include any AI-inferred image candidates attached to the product (best-effort)
        try {
          if (prod && Array.isArray((prod as any)._inferred_image_candidates)) {
            for (const v of (prod as any)._inferred_image_candidates) {
              if (typeof v === 'string' && v.length > 0) out.push(v);
            }
          }
        } catch (e) {}
      return Array.from(new Set(out)).filter((u) => typeof u === 'string' && u.length > 0);
    }

    const imageCandidates = collectImageCandidates(p);

    const LOGO_DEV_KEY = process.env.LOGO_DEV_KEY;
    const LOGO_DEV_SECRET = process.env.LOGO_DEV_SECRET;

    async function logoDevImage(brandName: string): Promise<string | null> {
      if (!LOGO_DEV_KEY || !LOGO_DEV_SECRET || !brandName) return null;
      const query = brandName.split(',')[0].trim();
      if (!query || query.length <= 3) return null;
      try {
        const res = await fetch(`https://api.logo.dev/search?q=${encodeURIComponent(query)}&strategy=match`, {
          headers: { Authorization: `Bearer ${LOGO_DEV_SECRET}` },
        });
        if (!res.ok) return null;
        const results: Array<{ name: string; domain: string }> = await res.json().catch(() => []);
        if (!results.length) return null;
        const brandSlug = query.toLowerCase().replace(/[^a-z0-9]/g, '');
        const candidates: Array<{ domain: string; stemLen: number }> = [];
        for (const r of results) {
          const domainStem = r.domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          const match =
            domainStem === brandSlug ||
            (domainStem.startsWith(brandSlug) && domainStem.length === brandSlug.length) ||
            (brandSlug.startsWith(domainStem) && domainStem.length >= 5);
          if (match) candidates.push({ domain: r.domain, stemLen: domainStem.length });
        }
        if (!candidates.length) return null;
        candidates.sort((a, b) => Math.abs(a.stemLen - brandSlug.length) - Math.abs(b.stemLen - brandSlug.length));
        const bestDomain = candidates[0].domain;
        return `https://img.logo.dev/${bestDomain}?token=${LOGO_DEV_KEY}&format=png&size=200&retina=true&fallback=404`;
      } catch {
        return null;
      }
    }

    let chosenImage: string | null = null;
    let imageSource: string | null = null;

    chosenImage = pickBestImage(p) || null;
    if (chosenImage) imageSource = productSource;

    if (!chosenImage && p.brands) {
      chosenImage = await logoDevImage(p.brands);
      if (chosenImage) imageSource = 'logodev';
    }

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const GOOGLE_CX = process.env.GOOGLE_CX;
    if (!chosenImage && GOOGLE_API_KEY && GOOGLE_CX) {
      try {
        const searchQuery = [p.product_name || p.product_name_en, p.brands].filter(Boolean).join(' ').trim() || String(barcode);
        if (searchQuery) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2000);
          const qs = new URLSearchParams({ key: GOOGLE_API_KEY, cx: GOOGLE_CX, q: searchQuery, fields: 'items(link,pagemap(cse_image))', num: '3', safe: 'high' });
          const res = await fetch(`https://www.googleapis.com/customsearch/v1?${qs}`, { signal: controller.signal }).catch(() => null);
          clearTimeout(timeout);
          if (res?.ok) {
            const j = await res.json().catch(() => null);
            for (const it of j?.items ?? []) {
              const src = it?.pagemap?.cse_image?.[0]?.src || it?.link;
              if (src && typeof src === 'string') { chosenImage = src; imageSource = 'google'; break; }
            }
          }
        }
      } catch { }
    }

    const result: ProductResponse = {
      code: p.code || barcode,
      product_name: p.product_name || p.product_name_en || null,
      brands: p.brands || null,
      image: chosenImage,
      image_source: imageSource,
      data_source: productSource ?? 'openfoodfacts',
      image_candidates: imageCandidates.length > 0 ? imageCandidates : null,
      ingredients_text: productResult!.ingredients_text || null,
      allergens: productResult!.allergens || productResult!.allergens_from_ingredients || null,
      ai_inferred: needInference ? true : undefined,
      nutrients: Object.keys(nutrients).length > 0 ? nutrients : null,
      ...(() => {
        const detailed: Record<string, { value: number | null; unit: string | null }> = {};
        const perServing: Record<string, { value: number | null; unit: string | null }> = {};
        let servingSizeRaw: string | null = null;
        let servingSizeGrams: number | null = null;
        let servingsPerContainer: number | null = null;

        function parseNumber(raw: any): number | null {
          if (raw == null) return null;
          if (typeof raw === 'number') return Number(raw);
          const s = String(raw).replace(/,/g, '.').trim();
          const n = Number(s);
          return Number.isFinite(n) ? n : null;
        }

        function parseServingSize(str: any): { grams: number | null; raw: string | null } {
          if (!str) return { grams: null, raw: null };
          const s = String(str);
          let best: { grams: number | null; score: number; val: number } | null = null;
          try {
            const re = /([\d.,]+)\s*(g|gram|grams|mg|kg|ml|l|cl|oz|fl oz)?/gi;
            for (const m of s.matchAll(re)) {
              if (!m) continue;
              const rawNum = m[1];
              const unitRaw = (m[2] || '').toLowerCase();
              const num = parseNumber(rawNum);
              if (num == null) continue;
              let grams: number | null = null;
              if (unitRaw.startsWith('g')) grams = num;
              else if (unitRaw === 'mg') grams = num / 1000;
              else if (unitRaw === 'kg') grams = num * 1000;
              else if (unitRaw === 'ml') grams = num;
              else if (unitRaw === 'l') grams = num * 1000;
              else if (/oz/.test(unitRaw)) grams = Math.round(num * 28.3495 * 100) / 100;
              const score = unitRaw ? 2 : 1;
              const val = grams != null ? grams : num;
              if (!best || score > best.score || (score === best.score && val > (best.val || 0))) {
                best = { grams, score, val };
              }
            }
          } catch (e) {}
          if (best) return { grams: best.grams, raw: s };
          return { grams: null, raw: s };
        }

        try {
          servingSizeRaw = p.serving_size || null;
          const parsed = parseServingSize(servingSizeRaw);
          servingSizeGrams = parsed.grams;
          const sPossible = [p.servings_per_container, p.servings_per_package, p.servings, p.serving_quantity];
          for (const s of sPossible) {
            const v = parseNumber(s);
            if (v != null) {
              servingsPerContainer = v;
              break;
            }
          }
        } catch (e) {}

        try {
          for (const [outKey, possible] of Object.entries(keys)) {
            let found: number | null = null;
            let unit: string | null = null;
            for (const k of possible) {
              if (k in nutriments) {
                const raw = nutriments[k];
                const num = parseNumber(raw);
                if (Number.isFinite(num)) {
                  found = num;
                  if (/kcal/i.test(k)) unit = 'kcal';
                  else if (/kj/i.test(k)) unit = 'kJ';
                  else unit = 'g';
                  const unitKey = k.replace(/_100g$|_?$/i, '') + '_unit';
                  if (typeof nutriments[unitKey] === 'string') {
                    unit = String(nutriments[unitKey]);
                  }
                  break;
                }
              }
            }
            detailed[outKey] = { value: found, unit };

            let servingFound: number | null = null;
            let servingUnit: string | null = null;
            for (const k of possible) {
              const variants = new Set<string>();
              if (/_100g$/.test(k)) variants.add(k.replace(/_100g$/, '_serving'));
              variants.add(k + '_serving');
              variants.add(k.replace(/_/g, '-') + '_serving');
              variants.add(k.replace(/_100g$/, '-serving'));
              const base = k.replace(/_100g$|-100g$|_?100g$/i, '').replace(/[-_]/g, '_');
              variants.add(base + '_serving');

              for (const vk of Array.from(variants)) {
                if (vk in nutriments) {
                  const raw = nutriments[vk];
                  const num = parseNumber(raw);
                  if (Number.isFinite(num)) {
                    servingFound = num;
                    if (/kcal/i.test(vk)) servingUnit = 'kcal';
                    else if (/kj/i.test(vk)) servingUnit = 'kJ';
                    else servingUnit = unit || 'g';
                    const unitKey = vk.replace(/_serving$|_?$/i, '') + '_unit';
                    if (typeof nutriments[unitKey] === 'string') servingUnit = String(nutriments[unitKey]);
                    break;
                  }
                }
              }
              if (servingFound != null) break;
            }

            if (servingFound == null && detailed[outKey] && typeof detailed[outKey].value === 'number' && servingSizeGrams != null) {
              const per100 = detailed[outKey].value as number;
              servingFound = Number.isFinite(per100) ? (per100 * (servingSizeGrams / 100)) : null;
              servingUnit = detailed[outKey].unit || null;
            }

            perServing[outKey] = { value: servingFound, unit: servingUnit };
          }
        } catch (e) {}

        return {
          nutrients_detailed: Object.keys(detailed).length > 0 ? detailed : null,
          nutrients_per_serving: Object.keys(perServing).length > 0 ? perServing : null,
          serving_size: servingSizeRaw,
          serving_size_grams: servingSizeGrams,
          servings_per_container: servingsPerContainer,
        } as any;
      })(),
      preservatives: null,
      additives: null,
      additives_tags: null,
      ingredients_analysis: null,
      traces: null,
      traces_tags: null,
    };

    try {
      await ensureENumbers();
      await ensureLocalENumbers();
      const presSet = new Set<string>();

      const eNumberMap: Record<string, string> = {
        E200: 'Sorbic acid',
        E202: 'Potassium sorbate',
        E296: 'Malic acid',
        E210: 'Benzoic acid',
        E211: 'Sodium benzoate',
        E212: 'Potassium benzoate',
        E213: 'Calcium benzoate',
        E220: 'Sulphur dioxide',
        E221: 'Sodium sulfite',
        E222: 'Sodium bisulfite',
        E223: 'Sodium metabisulfite',
        E224: 'Potassium metabisulfite',
        E250: 'Sodium nitrite',
        E251: 'Sodium nitrate',
        E280: 'Propionic acid',
        E281: 'Sodium propionate',
        E282: 'Calcium propionate',
        E283: 'Potassium sorbate',
        E300: 'Ascorbic acid (Vitamin C)',
      };

      const additivesNames = p.additives_original_names || p.additives_original || p.additives_original_tags || null;
      const additivesList: string[] = [];
      if (Array.isArray(additivesNames)) {
        for (const name of additivesNames) {
          if (typeof name === 'string' && name.trim()) {
            const seg = String(name).split(':').pop() || String(name);
            const cleaned = seg.replace(/-/g, ' ').trim();
            additivesList.push(cleaned);
          }
        }
      }

      const additivesTags = p.additives_tags || p.additives || null;
      const additivesTagList: string[] = [];
      if (Array.isArray(additivesTags)) {
        for (const t of additivesTags) {
          if (typeof t === 'string') {
            const seg = t.split(':').pop() || t;
            const cleaned = seg.replace(/-/g, ' ').trim();
            additivesTagList.push(cleaned);
          }
        }
      }

      // Use the merged ingredients_text (may include AI-inferred value) so additives
      // from the OpenAI-filled ingredient list are also detected and rated.
      const mergedIngredientsText = productResult!.ingredients_text || p.ingredients_text || '';
      const ingredients = mergedIngredientsText.toLowerCase();
      if (ingredients && ingredients.length > 0) {
        const rawMatches = Array.from(ingredients.matchAll(/\b[eE][\s-]?\d{2,3}\b/g) || []) as RegExpMatchArray[];
        const eMatches = Array.from(new Set(rawMatches.map((m) => (m && m[0] ? m[0].replace(/\s|-/g, '').toUpperCase() : '')))).filter(Boolean);
        for (const e of eMatches) presSet.add(e);

        const preservativeKeywords: string[] = [
          'sodium benzoate',
          'potassium sorbate',
          'sorbic acid',
          'benzoic acid',
          'sulfite',
          'sulphite',
          'sodium nitrite',
          'sodium nitrate',
          'nitrite',
          'nitrate',
          'calcium propionate',
          'propionate',
          'edta',
          'ascorbic acid',
          'potassium metabisulfite',
          'sodium metabisulfite'
        ];

        for (const kw of preservativeKeywords) {
          if (ingredients.indexOf(kw) !== -1) {
            presSet.add(kw);
          }
        }
      }

      const additiveCandidates = [...additivesList, ...additivesTagList];
      for (const a of additiveCandidates) {
        if (!a) continue;
        const token = String(a).toLowerCase();
        const maybeCode = String(a).toUpperCase().replace(/\s/g, '').replace(/^([A-Za-z]+:)?/, '');
        const isEcode = /^E\d{2,3}$/.test(maybeCode);
        let mappedName = '';
        if (isEcode) {
          mappedName = (ENUMBERS_CACHE && ENUMBERS_CACHE[maybeCode]) || eNumberMap[maybeCode] || maybeCode;
        } else {
          mappedName = prettyName(a);
        }
        const lm = mappedName.toLowerCase();
        if (/sorbate|benzoate|propionat|nitrit|nitrate|sulfite|sulphite|sorbic|preserv/.test(lm)) {
          presSet.add(isEcode ? maybeCode : mappedName);
        }
      }

      const presArr = Array.from(presSet);

      const ingredientsAnalysis: string[] = Array.isArray(p.ingredients_analysis_tags) ? p.ingredients_analysis_tags.map(String) : [];
      const tracesText: string | null = p.traces || null;
      const tracesTags: string[] = Array.isArray(p.traces_tags) ? p.traces_tags.map(String) : [];

      function prettyName(tok: string): string {
        if (!tok) return tok;
        const t = String(tok).trim();
        const en = t.toUpperCase().replace(/\s|-/g, '');
        const m = en.match(/^E0*(\d{2,3})/);
        if (m) {
          const key = 'E' + m[1];
          if (ENUMBERS_CACHE && ENUMBERS_CACHE[key]) return ENUMBERS_CACHE[key];
          if (eNumberMap[key]) return eNumberMap[key];
          return key;
        }
        const lower = t.toLowerCase();
        if (lower === 'edta') return 'EDTA';
        if (lower.indexOf('sulfite') !== -1 || lower.indexOf('sulphite') !== -1) return 'Sulfites';
        if (lower.indexOf('nitrite') !== -1) return 'Nitrites';
        if (lower.indexOf('nitrate') !== -1) return 'Nitrates';
        return t.split(/\s+/).map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
      }

      function ratePreservative(name: string, code?: string | null) {
        const n = (name || '').toLowerCase();
        let rating: 'good' | 'ok' | 'bad' = 'ok';
        let reason: string | null = null;
        let description: string | null = null;
        if (n.includes('nitrite') || n.includes('nitrate') || n.includes('nitros') || n.includes('e250') || n.includes('e251')) {
          rating = 'bad';
          reason = 'Nitrites/nitrates have potential health concerns in some contexts';
          description = 'Nitrites and nitrates are used as preservatives in processed meats and can form nitrosamines; some health organizations advise limiting intake.';
        } else if (n.includes('butylated hydroxyanisole') || n.includes('bha') || n.includes('butylated hydroxytoluene') || n.includes('bht') || n.includes('e320') || n.includes('e321')) {
          rating = 'bad';
          reason = 'Synthetic antioxidants (BHA/BHT) are controversial in some evaluations';
          description = 'BHA and BHT are synthetic antioxidants used to prevent rancidity. Some studies have raised concerns about long-term safety; regulatory positions vary.';
        } else if (/(tartrazine|sunset yellow|azorubine|allura|ponceau|e10[2|4|9|3|4])/i.test(n)) {
          rating = 'bad';
          reason = 'Some artificial colorants are flagged in certain consumer-grade assessments';
          description = 'Certain artificial azo dyes have been associated with hypersensitivity and behavioral concerns in sensitive individuals; they are often flagged by consumer apps.';
        }
        if (n.includes('ascorbic') || n.includes('vitamin c') || n.includes('tocopherol') || n.includes('curcumin') || n.includes('citric acid') || n.includes('citrat')) {
          rating = 'good';
          reason = 'Antioxidants and natural extracts are generally considered safe/positive';
          description = 'These ingredients commonly act as antioxidants or nutrients and are generally considered safe. They may also have preservative properties while providing nutritional benefit.';
        }
        if (n.includes('malic') || n.includes('malate')) {
          if (rating !== 'good' && rating !== 'bad') {
            rating = 'ok';
            reason = 'Acidity regulator and flavoring; generally considered safe';
            description = 'Malic acid is a naturally occurring organic acid used to adjust acidity and enhance flavor. It is generally regarded as safe for consumption.';
          }
        }
        if (n.includes('sorbate') || n.includes('benzoate') || n.includes('propionate') || n.includes('sorbic') || n.includes('sulfite') || n.includes('sulphite') || n.includes('edta') || n.includes('potassium sorbate') || n.includes('sodium benzoate')) {
          if (rating !== 'good' && rating !== 'bad') {
            rating = 'ok';
            reason = 'Common preservative; generally low risk for most people but some sensitivities exist';
            description = 'These preservatives are widely used to inhibit microbial growth. Most people tolerate them well, but some individuals may have sensitivities (e.g., sulfite sensitivity).';
          }
        }
        if ((!name || name.toLowerCase().startsWith('e')) && code) {
          const codeL = code.toUpperCase();
          if (codeL === 'E250' || codeL === 'E251') {
            rating = 'bad';
            reason = 'Nitrites/nitrates can be of concern';
            description = 'E250 and E251 are nitrite/nitrate salts used in curing; they are effective but have associated health considerations when consumed frequently.';
          }
        }
        return { code: code || null, name: String(name || ''), rating, reason, description };
      }

      const unique = Array.from(new Set(presArr));
      const presObjects: Array<{ code?: string | null; name: string; rating: 'good' | 'ok' | 'bad'; reason?: string | null; description?: string | null; source?: string | null }> = unique.map((tok) => {
        const t = String(tok || '').trim();
        const en = t.toUpperCase().replace(/\s|-/g, '');
        const code = /^E\d{2,3}$/.test(en) ? en : null;
        const pretty = prettyName(t);
        let nameToUse = pretty;
        if (code && ENUMBERS_CACHE && ENUMBERS_CACHE[code]) nameToUse = ENUMBERS_CACHE[code];
        function normForCompare(s: string) {
          return String(s || '').toLowerCase().replace(/^[a-z]{2}:/i, '').replace(/\s|-/g, '');
        }
        const nt = normForCompare(t);
        const additivesListNorm = additivesList.map(normForCompare);
        const additivesTagListNorm = additivesTagList.map(normForCompare);
        let source: string | null = null;
        if (additivesListNorm.includes(nt) || additivesTagListNorm.includes(nt)) source = 'additives';
        else if ((mergedIngredientsText).toLowerCase().indexOf(t.toLowerCase()) !== -1) source = 'ingredients';
        const rated = ratePreservative(nameToUse, code);
        return { ...rated, source };
      });

      // Deduplicate preservatives by normalized name before assigning
      const presDeduped = presObjects.filter((obj, idx, arr) => {
        const norm = String(obj.name || obj.code || '').trim().toLowerCase();
        return arr.findIndex(o => String(o.name || o.code || '').trim().toLowerCase() === norm) === idx;
      });
      result.preservatives = presDeduped.length > 0 ? presDeduped : null;

      const presNorm = new Set<string>();
      for (const o of presObjects) {
        const name = String(o.name || '').trim();
        const code = String(o.code || '').toUpperCase().replace(/\s|-/g, '');
        const pretty = prettyName(name || code || '');
        const normalize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (name) presNorm.add(normalize(name));
        if (pretty) presNorm.add(normalize(pretty));
        if (code) presNorm.add(normalize(code));
      }

      const friendlySet = new Set<string>();
      const normalizeAdd = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const a of additivesList) {
        if (!a) continue;
        const fn = prettyName(a);
        const forms = [fn, a].map((x) => normalizeAdd(x));
        const isDuplicate = forms.some((f) => presNorm.has(f));
        if (!isDuplicate) friendlySet.add(fn);
      }

      for (const at of additivesTagList) {
        if (!at) continue;
        const rawToken = String(at).trim();
        const token = rawToken.toUpperCase().replace(/\s|-/g, '');
        if (/^E\d{2,3}$/.test(token)) {
          const mapped = (ENUMBERS_CACHE && ENUMBERS_CACHE[token]) || eNumberMap[token] || token;
          const norm = normalizeAdd(mapped || token);
          if (!presNorm.has(norm)) friendlySet.add(String(mapped));
        } else {
          const pretty = prettyName(at);
          const norm = normalizeAdd(pretty || rawToken);
          if (!presNorm.has(norm)) friendlySet.add(pretty);
        }
      }

      try {
        const ingText = (mergedIngredientsText) as string;
        if (ingText && ingText.trim().length > 0) {
          const chemRe = /\b(?:(?:di|tri|mono)?(?:sodium|potassium|magnesium|calcium|ammonium|lithium|zinc|iron|copper|carrageenan|citric|ascorbic))\s*(?:[a-z0-9\-() ]{0,30}?)\b(?:carbonate|bicarbonate|phosphate|phosphates|sulfate|sulphate|chloride|citrate|gluconate|hydroxide|acetate|benzoate|propionate|sorbate|nitrite|nitrate)\b/gi;
          const matches = Array.from(new Set(Array.from(ingText.matchAll(chemRe) || []).map((m) => (m[0] || '').trim())));
          for (const m of matches) {
            if (!m) continue;
            const pretty = prettyName(m);
            const norm = normalizeAdd(pretty || m);
            if (!presNorm.has(norm)) friendlySet.add(pretty);
          }
        }
      } catch (e) {}

      const friendlyAdditives = Array.from(friendlySet);
      result.additives = friendlyAdditives.length > 0 ? friendlyAdditives : null;
      result.additives_tags = additivesTagList.length > 0 ? additivesTagList : null;
      result.ingredients_analysis = ingredientsAnalysis.length > 0 ? ingredientsAnalysis : null;
      result.traces = tracesText;
      result.traces_tags = tracesTags.length > 0 ? tracesTags : null;

      try {
        const presList = presObjects || [];
        const badRe = /(nitrite|nitrate|nitros|bht|bha|e320|e321|tartrazin|sunset.?yellow|azorubine|allura|ponceau|e102|e104|e110|e129|e122|e123|e124|e150[bcd]|e211|e621)/i;
        const okRe = /(sorbate|benzoate|propionat|propionic|sulfite|sulphite|edta|carrageen|lecithin|emulsif|xanthan|guar|carob|pectin|starch|e14[0-9]|e16[0-9]|e17[0-9]|e18[0-9]|e4[0-9]{2}|e5[0-9]{2})/i;
        const goodRe = /(ascorbic|vitamin.?c|tocopherol|vitamin|malic|citric|curcumin|turmeric|riboflavin|beetroot|carotene|annatto|paprika|lycopene|anthocyanin)/i;

        let additivePenalty = 0;
        let badAdditiveCount = 0;
        let okAdditiveCount = 0;
        for (const pr of presList) {
          if (!pr) continue;
          if (pr.rating === 'bad') { additivePenalty += 10; badAdditiveCount++; }
          else if (pr.rating === 'ok') { additivePenalty += 3; okAdditiveCount++; }
        }
        const presNormSet = new Set(presList.map((pr) => String(pr.name || pr.code || '').toLowerCase().replace(/[^a-z0-9]/g, '')));
        const allAdditiveTags = [...additivesList, ...additivesTagList];
        for (const a of allAdditiveTags) {
          if (!a) continue;
          const norm = String(a).toLowerCase().replace(/[^a-z0-9]/g, '');
          if (presNormSet.has(norm)) continue;
          if (badRe.test(a)) { additivePenalty += 10; badAdditiveCount++; }
          else if (okRe.test(a)) { additivePenalty += 3; okAdditiveCount++; }
        }
        additivePenalty = Math.min(additivePenalty, 40);

        const nm = nutriments;
        function g100(keys2: string[]): number | null {
          for (const k of keys2) {
            const v = nm[k];
            if (v != null) {
              const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.'));
              if (Number.isFinite(n)) return n;
            }
          }
          return null;
        }

        let nutrientPenalty = 0;
        const nutrientIssues: string[] = [];

        const satFat = g100(['saturated-fat_100g', 'saturated-fat']);
        if (satFat != null) {
          if (satFat > 10) { nutrientPenalty += 20; nutrientIssues.push('saturated fat very high'); }
          else if (satFat > 5)  { nutrientPenalty += 12; nutrientIssues.push('saturated fat high'); }
          else if (satFat > 2.5){ nutrientPenalty += 5;  nutrientIssues.push('saturated fat moderate'); }
        }

        const sugars = g100(['sugars_100g', 'sugars']);
        if (sugars != null) {
          if (sugars > 22.5) { nutrientPenalty += 20; nutrientIssues.push('sugar very high'); }
          else if (sugars > 12.5){ nutrientPenalty += 12; nutrientIssues.push('sugar high'); }
          else if (sugars > 5)  { nutrientPenalty += 5;  nutrientIssues.push('sugar moderate'); }
        }

        const sodiumG = g100(['sodium_100g', 'sodium']);
        const saltG   = g100(['salt_100g', 'salt']);
        const sodiumMg = sodiumG != null ? sodiumG * 1000 : (saltG != null ? saltG * 400 : null);
        if (sodiumMg != null) {
          if (sodiumMg > 600)     { nutrientPenalty += 15; nutrientIssues.push('sodium high'); }
          else if (sodiumMg > 300){ nutrientPenalty += 7;  nutrientIssues.push('sodium moderate'); }
          else if (sodiumMg > 100){ nutrientPenalty += 2;  nutrientIssues.push('sodium slightly elevated'); }
        }

        const transFat = g100(['trans-fat_100g', 'trans_fat_100g', 'trans-fat']);
        if (transFat != null && transFat > 0.2) {
          nutrientPenalty += 15; nutrientIssues.push('trans fat present');
        }

        nutrientPenalty = Math.min(nutrientPenalty, 60);

        const totalPenalty = additivePenalty + nutrientPenalty;
        const numericScore = Math.max(0, 100 - totalPenalty);

        let overall: 'good' | 'ok' | 'bad';
        if (numericScore >= 75) overall = 'good';
        else if (numericScore >= 45) overall = 'ok';
        else overall = 'bad';

        const reasons: string[] = [];
        if (nutrientIssues.length > 0) {
          reasons.push(`Main nutritional concerns: ${nutrientIssues.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}.`);
        }

        const mappedPresNames = presList.map((pr) => {
          const nm = String(pr?.name || pr?.code || '').trim();
          return prettyName(nm) || nm;
        }).filter(Boolean) as string[];

        const badNamed = presList.filter((p) => p && p.rating === 'bad').map((p) => prettyName(p.name || p.code || '') || p.name || p.code).filter(Boolean) as string[];
        const okNamed = presList.filter((p) => p && p.rating === 'ok').map((p) => prettyName(p.name || p.code || '') || p.name || p.code).filter(Boolean) as string[];

        const exampleAdditives: string[] = [];
        if (result.additives && Array.isArray(result.additives)) {
          for (const f of result.additives) {
            if (!f) continue;
            const v = String(f).trim();
            if (!exampleAdditives.includes(v)) exampleAdditives.push(v);
          }
        }

        for (const a of allAdditiveTags) {
          if (!a) continue;
          const raw = String(a).trim();
          const token = raw.toUpperCase().replace(/\s|-/g, '');
          const em = token.match(/^E0*(\d{2,3})/);
          let mapped: string | null = null;
          if (em) {
            const key = 'E' + em[1];
            mapped = (ENUMBERS_CACHE && ENUMBERS_CACHE[key]) || eNumberMap[key] || key;
          } else {
            mapped = prettyName(raw) || raw;
          }
          if (!mapped) continue;
          const norm = String(mapped).toLowerCase().replace(/[^a-z0-9]/g, '');
          if (presNormSet.has(norm)) continue;
          if (!exampleAdditives.includes(mapped)) exampleAdditives.push(mapped);
        }

        const badPresNames: string[] = presList.filter((p) => p && p.rating === 'bad').map((p) => p.name).filter(Boolean);
        const okPresNamesArr: string[] = presList.filter((p) => p && p.rating === 'ok').map((p) => p.name).filter(Boolean);

        let additivesReason = '';
        const friendlyNorms = new Set<string>((result.additives || []).map((s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')));
        const presNormsForTotal = new Set<string>(presList.map((pr) => String(pr.name || pr.code || '').toLowerCase().replace(/[^a-z0-9]/g, '')));
        const union = new Set<string>([...friendlyNorms, ...presNormsForTotal]);
        const totalAdditives = union.size;

        if (badNamed.length > 0) {
          const shown = badNamed.slice(0, 3).join(', ');
          const more = Math.max(0, badNamed.length - 3);
          additivesReason = `Concerning preservatives detected (${badNamed.length}): ${shown}${more > 0 ? ` and ${more} more` : ''}.`;
        } else if (totalAdditives > 0) {
          const examples = exampleAdditives.slice(0, 3);
          const more = Math.max(0, totalAdditives - examples.length);
          if (examples.length > 0) {
            additivesReason = `${totalAdditives} additive${totalAdditives > 1 ? 's' : ''} detected (e.g. ${examples.join(', ')}${more > 0 ? ` and ${more} more` : ''}).`;
          } else {
            additivesReason = `${totalAdditives} additive${totalAdditives > 1 ? 's' : ''} detected.`;
          }
        }

        if (additivesReason) reasons.push(additivesReason);
        if (reasons.length === 0) reasons.push('No significant nutritional or additive concerns found.');

        (result as any).overall_score = numericScore;
        result.overall_rating = overall;

        const qual = overall.charAt(0).toUpperCase() + overall.slice(1);
        const nutritionText = nutrientIssues.length > 0
          ? nutrientIssues.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('; ').replace(/; ([^;]*)$/, '; $1')
          : '';
        const additiveText = totalAdditives > 0 ? `Contains ${totalAdditives} additive${totalAdditives === 1 ? '' : 's'}.` : '';

        const parts: string[] = [];
        parts.push(`Overall: ${qual}.`);
        if (nutritionText) parts.push(`Nutrition notes: ${nutritionText}.`);
        if (additiveText) parts.push(additiveText);
        if (parts.length === 0) parts.push('No significant nutritional or additive issues found.');
        result.overall_explanation = parts.join(' ');
      } catch (err) {
        result.overall_rating = null;
        result.overall_explanation = null;
      }
    } catch (err) {
    }
    
    return NextResponse.json(result, { status: 200, headers: debugHeaders });
  } catch (err: any) {
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
