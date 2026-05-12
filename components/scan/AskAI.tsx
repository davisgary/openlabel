"use client"
import React, { useState, useRef, useEffect } from 'react'
import { LuSendHorizontal, LuSparkles } from 'react-icons/lu'
import { mapRatingToScore } from './utils'

type Props = {
  product: any
  detectedCode?: string | null
  barcode?: string | null
  externalQuery?: string | null
  onQueryProcessed?: () => void
}

export default function AskAI({ product, detectedCode, barcode, externalQuery, onQueryProcessed }: Props) {
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiRaw, setAiRaw] = useState<string | null>(null)
  const [aiParsed, setAiParsed] = useState<any | null>(null)
  const [aiHistory, setAiHistory] = useState<Array<{ raw: string | null; parsed: any | null; question?: string | null; role?: 'user' | 'assistant'; pending?: boolean }>>([])
  const [showAI, setShowAI] = useState(false)
  const [followUpQuery, setFollowUpQuery] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    // Request animation frame ensures we run after the next paint
    requestAnimationFrame(() => {
      // Small timeout to allow for DOM layout shifts (like text wrapping)
      setTimeout(() => {
        if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
      }, 50)
    })
  }

  // Scroll to bottom whenever history updates, loading state changes, or errors occur
  useEffect(() => {
    if (aiHistory.length > 0 || aiLoading || aiError) {
      scrollToBottom()
    }
  }, [aiHistory.length, aiLoading, aiError])

  async function callOpenAI(body: any) {
    setAiError(null)
    setAiRaw(null)
    setShowAI(true)
    setAiLoading(true)
    try {
      const res = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const text = await res.text()
      let data: any = null
      try {
        data = text ? JSON.parse(text) : null
      } catch (err) {
        data = null
      }

      if (!res.ok || data?.error) {
        const errorCode = data?.error?.code ?? null
        const detailsText = data?.details ?? null

        // Handle common cases with friendlier messages
        if (errorCode === 'insufficient_quota' || (typeof detailsText === 'string' && detailsText.includes('insufficient_quota'))) {
          setAiError('OpenAI quota exceeded — your OpenAI account has insufficient quota. Check your billing/plan at https://platform.openai.com/account/usage and update your API key or plan.')
          return
        }

        if (res.status === 429) {
          setAiError('OpenAI rate limit exceeded — please wait a moment and try again.')
          return
        }

        // Fallback: prefer structured message, then details, then generic status
        const message = (data?.error && typeof data.error === 'object' && data.error.message) ? data.error.message : (data?.error ?? data?.details ?? `OpenAI error: ${res.status} ${res.statusText}`)
        setAiError(message)
        return
      }

  let parsed = data.parsed ?? null
  const raw = data.raw ?? ''

      if (!parsed && raw && typeof raw === 'string') {
        const fenceMatch = raw.match(/```(?:json\n)?([\s\S]*?)```/i)
        const jsonText = fenceMatch ? fenceMatch[1].trim() : raw.trim()
        try {
          parsed = JSON.parse(jsonText)
        } catch (e) {
          parsed = null
        }
      }

    setAiRaw(raw || null)
      setAiParsed(parsed)
      // append assistant response to history (include the user question if provided in the body)
      const questionText = body?.scanText ?? null
      setAiHistory((h) => {
        const next = [...h, { raw: raw || null, parsed, question: questionText, role: 'assistant' as const }]
        return next
      })
  setShowAI(true)
      // If the assistant returned no content, show an error so the user knows
      if ((!parsed || Object.keys(parsed).length === 0) && (!raw || raw.trim() === '')) {
        setAiError('No assistant response received')
      }
      } catch (e: any) {
      setAiError(e?.message || String(e))
    } finally {
      setAiLoading(false)
    }
  }

  React.useEffect(() => {
    if (!product) return
    setAiHistory([])
    setAiParsed(null)
    setAiRaw(null)
    setShowAI(false)
  }, [product])

  async function askFollowUp(queryOverride?: string) {
    if (!product) return
    const query = queryOverride || followUpQuery.trim()
    if (!query) return
    // allow user questions even when no prior AI overview exists
    const text = `${detectedCode || barcode || ''}\n\nUser question: ${query}`
    const uiScore = mapRatingToScore(product?.overall_score ?? product?.overall_rating)
  // Include the entire history so the assistant has the original answer and prior follow-ups as context.
  const previousAI = aiHistory.length ? aiHistory : (aiParsed || aiRaw ? [{ raw: aiRaw, parsed: aiParsed }] : null)

  // Append the user's question immediately so it's visible while the assistant responds.
  setAiHistory((h) => [...h, { raw: null, parsed: null, question: query, role: 'user' as const, pending: true }])
  if (!queryOverride) setFollowUpQuery('')

  await callOpenAI({ product, scanText: text, uiScore, previousAI })
  }

  // Handle external queries (e.g. from clicking an additive)
  useEffect(() => {
    if (externalQuery && !aiLoading) {
      askFollowUp(externalQuery)
      onQueryProcessed?.()
    }
  }, [externalQuery, aiLoading, onQueryProcessed])

  return (
    <div className="py-4 border-t border-muted">
      <div className="flex flex-col gap-2">
        <div>
          <div className="text-sm text-primary-foreground font-semibold flex items-center gap-2">
            <LuSparkles className="w-4 h-4 text-accent" />
            <span>Ask AI about this product</span>
          </div>
        </div>
        {/* Answers / history will be shown above the input so users can read then ask follow-ups */}
        {showAI && (
          <div className="mt-3 bg-muted/5 rounded-md p-3 text-sm text-primary-foreground">
            {aiLoading && <div>AI is generating insights…</div>}
            {aiError && <div className="text-destructive">{aiError}</div>}

            {!aiError && aiHistory.length > 0 && (
              <div className="space-y-3">
                {aiHistory.map((entry, idx) => {
                  const isUser = entry.role === 'user'
                  const data = entry.parsed ?? null
                  const raw = entry.raw ?? ''

                  if (isUser) {
                    return (
                      <div key={idx} className="flex justify-end px-3 py-2">
                        <div className="max-w-[80%] bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm">
                          {entry.question}
                        </div>
                      </div>
                    )
                  }

                  // assistant
                  return (
                    <div key={idx} className="flex justify-start px-3 py-2">
                      <div className="max-w-[80%] bg-muted/5 border border-muted p-3 rounded-md text-sm text-primary-foreground">
                        {data && data.followUpAnswer ? (
                          <div className="text-sm">{data.followUpAnswer}</div>
                        ) : data ? (
                          <div>
                            <div className="font-semibold">Summary</div>
                            <div>{data.summary}</div>

                            {data.positives && data.positives.length > 0 && (
                              <div>
                                <div className="font-semibold">Good points</div>
                                <ul className="list-disc list-inside">
                                  {data.positives.map((p: string, i: number) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div>
                              <div className="font-semibold">Concerns</div>
                              <ul className="list-disc list-inside">
                                {(data.concerns || []).map((c: string, i: number) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <div className="font-semibold">Tips</div>
                              <ul className="list-disc list-inside">
                                {(data.tips || []).map((t: string, i: number) => (
                                  <li key={i}>{t}</li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <div className="font-semibold">Alternatives</div>
                              <ul className="list-disc list-inside">
                                {(data.alternatives || []).map((a: string, i: number) => (
                                  <li key={i}>{a}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="italic">{data.consumerAdvice}</div>
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap text-xs">{raw || entry.question}</pre>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* allow focus ring to overflow this container (mobile browsers sometimes clip it) */}
          <div className="relative flex-1 overflow-visible">
            <input
              value={followUpQuery}
              onChange={(e) => setFollowUpQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!aiLoading && followUpQuery.trim()) {
                    askFollowUp()
                  }
                }
              }}
              placeholder="Ask a question about this product"
              className="w-full pr-12 rounded-full border border-primary-foreground/70 px-4 py-2 text-[16px] sm:text-sm text-primary-foreground bg-transparent placeholder:text-primary-foreground/70 focus:outline-none focus:ring-0 focus:border-accent dark:focus:border-accent transition-colors duration-200"
            />

            <button
              onClick={() => askFollowUp()}
              disabled={aiLoading || !followUpQuery.trim()}
              aria-label="Ask AI"
              className={`absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center p-2.5 rounded-full text-accent transition-colors ease-in-out duration-300 ${aiLoading ? 'opacity-90 cursor-not-allowed' : (followUpQuery && String(followUpQuery).trim() ? 'opacity-100' : 'opacity-90')}`}
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full transition-opacity duration-300 ease-out hover:opacity-80">
                {aiLoading ? (
                  <span className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  ) : (
                  <LuSendHorizontal className="w-5 h-5 text-accent hover:text-accent/90 transition-colors duration-300 ease-out" />
                )}
              </span>
            </button>
          </div>
        </div>
        {aiHistory.length > 0 && (
          <div ref={bottomRef} className="h-12" aria-hidden="true" />
        )}
      </div>
    </div>
  )
}
