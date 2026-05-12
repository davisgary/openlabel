import { NextResponse } from 'next/server'

type RequestBody = {
  product?: any
  scanText?: string
  uiScore?: number
  previousAI?: any
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json()

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 })
    }

    function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(n))) }
    function computeHealthScore(product: any): number | null {
      try {
        const provided = typeof product?.overall_score === 'number' ? product.overall_score : (typeof product?.overall_rating === 'number' ? product.overall_rating : null)
        if (provided !== null) return clamp(provided)
        const nut = product?.nutrition ?? product?.nutritionFacts ?? null
        if (!nut) return null
        const sugar = typeof nut.sugar_g === 'number' ? nut.sugar_g : (typeof nut.sugars === 'number' ? nut.sugars : null)
        const satFat = typeof nut.sat_fat_g === 'number' ? nut.sat_fat_g : (typeof nut.saturated_fat_g === 'number' ? nut.saturated_fat_g : null)
        const calories = typeof nut.calories === 'number' ? nut.calories : null
        const sodium = typeof nut.sodium_mg === 'number' ? nut.sodium_mg : null

        let score = 100
        if (sugar !== null) score -= Math.min(50, sugar * 2)
        if (satFat !== null) score -= Math.min(30, satFat * 3)
        if (calories !== null) score -= Math.min(20, calories / 50)
        if (sodium !== null) score -= Math.min(15, sodium / 200)

        const hasBad = Array.isArray(product?.ingredients)
          ? product.ingredients.join(' ').match(/corn syrup|high fructose|hydrogenated|partially hydrogenated|artificial flavor|preservative|sodium benzoate|tbq/i)
          : null
        if (hasBad) score -= 10

        return clamp(score)
      } catch (e) {
        return null
      }
    }

  // If the client provided a canonical UI score, prefer that. Otherwise compute from product.
  const providedUiScore = (typeof body?.uiScore === 'number' && Number.isFinite(body.uiScore)) ? clamp(body.uiScore) : null
  const computedScore = providedUiScore !== null ? providedUiScore : (body.product ? computeHealthScore(body.product) : null)

  const productPart = body.product ? `Product JSON:\n${JSON.stringify(body.product, null, 2)}\n\nComputedHealthScore: ${computedScore ?? 'null'}${providedUiScore !== null ? ' (provided by UI)' : ''}` : ''
  const previousPart = body.previousAI ? `Previous AI analysis (JSON):\n${typeof body.previousAI === 'string' ? body.previousAI : JSON.stringify(body.previousAI, null, 2)}\n\n` : ''
  const scanPart = body.scanText ? `Scan text:\n${body.scanText}` : ''

  // If this request includes previousAI, prefer concise follow-up-only answers unless the user asked to update the full analysis.
  const followUpMode = body.previousAI ? `If this is a follow-up question (you received a previous analysis above), RETURN ONLY a concise direct answer in a top-level key named "followUpAnswer" (1-2 sentences). Do NOT include the full analysis (summary, positives, concerns, tips, alternatives, consumerAdvice) unless the user explicitly asked to update or expand the analysis. If the user asked to update the analysis, include only the fields you change or add.\n\n` : ''

  const userPrompt = `${productPart}\n${scanPart}\n\n${followUpMode}You are a helpful assistant that analyzes Open Label results and returns actionable health-focused insights for consumers.\nIf a "Previous AI analysis" is provided and the Scan text contains a follow-up question, answer the follow-up directly using the previous analysis as context — do not simply repeat the user's follow-up. Provide a concise direct answer to the follow-up in a top-level key named "followUpAnswer" (one or two sentences) in addition to the full JSON analysis when appropriate. If the follow-up requires updating the analysis, update or extend the existing JSON fields; otherwise keep them unchanged.\nRespond with JSON only, with the following keys (include keys in this order):\n- followUpAnswer: (present only for follow-ups) a 1-2 sentence direct answer to the user's follow-up question.\n- positives: array of 0-3 short strings describing what is good about the product (e.g., "good protein source", "whole nuts", "no added sugar"). If there are no clear positives, return an empty array.\n- summary: a short (1-2 sentence) summary of the product and its main characteristics.\n- concerns: array of strings listing any ingredients or nutrition facts that may be concerning (e.g., high sugar, saturated fat, additives). For additives, be explicit: include the additive name and a one-line assessment stating whether it's generally considered low/medium/high concern and a short reason (e.g., "citric acid — low concern: common flavoring generally regarded as safe; not typically harmful at food levels").\n- tips: array of 3 short, practical nutrition tips related to this product.\n- alternatives: array of up to 3 suggested healthier alternatives (one-line each).\n- consumerAdvice: one short sentence the consumer should know.\n\nImportant presentation requirements:\n1) Do NOT include a separate "healthScore" or "allergens" key in your JSON response — the UI shows those already.\n2) Put the "positives" information before "concerns" in the JSON so that UIs can surface the good aspects first.\n3) Even for lower-scoring products, try to include at least one small positive (e.g., "contains protein", "good source of fiber") unless there truly are none.\n4) When a ComputedHealthScore is provided, DO NOT change that numeric value — use it as the canonical score and provide a one-line justification that matches it in the summary text if relevant. If no computed score is provided, you may estimate a score but label it clearly as an estimate (e.g., "estimatedHealthScore") and do not return it as a separate field.\nBe concise. If information is missing from the input, say which fields were missing in the summary.\n`;

    // Build chat messages. Include previous AI analysis as an assistant message when present so the model has clear context.
    const messages: any[] = [
      { role: 'system', content: 'You are an assistant that provides concise, structured, consumer-friendly health insights for food and Open Labels.' },
    ]
    if (body.previousAI) {
      const prev = typeof body.previousAI === 'string' ? body.previousAI : JSON.stringify(body.previousAI, null, 2)
      messages.push({ role: 'assistant', content: `Previous analysis:\n${prev}` })
    }
    messages.push({ role: 'user', content: userPrompt })

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.6,
      }),
    })

    // Read raw text so we can handle non-JSON responses gracefully and log them for debugging
    const openAiText = await openAiResponse.text()
    let openAiJson: any = null
    try {
      openAiJson = openAiText ? JSON.parse(openAiText) : null
    } catch (err) {
      openAiJson = null
    }

    if (!openAiResponse.ok) {
      return NextResponse.json({ error: 'OpenAI API error', details: openAiJson ?? openAiText }, { status: 502 })
    }

    const data = openAiJson ?? null
    // The assistant message is expected in data.choices[0].message.content; if parsing failed, fall back to raw text
    const assistant = data?.choices?.[0]?.message?.content ?? (typeof openAiText === 'string' && openAiText.trim() ? openAiText : null)

    // Normalize assistant output: strip Markdown fences and parse JSON when possible.
    let parsed = null
    let raw = assistant
    if (assistant && typeof assistant === 'string') {
      const fenceStrip = assistant.replace(/^```\s*(json)?\n?/i, '').replace(/```\s*$/i, '').trim()
      raw = fenceStrip
      try {
        parsed = JSON.parse(fenceStrip)
      } catch (err) {
        parsed = null
      }
    }

    // If parsed is present and we computed a deterministic score, ensure the assistant's
    // returned healthScore matches the computed score (or include it in the response).
    if (parsed && computedScore !== null) {
      try {
        const aiScore = typeof parsed.healthScore === 'number' ? parsed.healthScore : null
        if (aiScore !== null && aiScore !== computedScore) {
          parsed.providedHealthScore = aiScore
          parsed.healthScore = computedScore
          parsed.healthScoreNote = `healthScore set to computed value ${computedScore}; assistant provided ${aiScore}`
        }
      } catch {}
    }

    return NextResponse.json({ success: true, raw: assistant, parsed })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'OpenAI route is up' })
}
