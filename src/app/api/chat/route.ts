import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Rate limiting — in-memory store (resets on server restart)
// Limits: 20 requests per IP per 10 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const WINDOW_MS = 10 * 60 * 1000 // 10 minutes

function getIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  if (entry.count >= RATE_LIMIT) return true

  entry.count++
  return false
}

const SYSTEM_PROMPT = `You are a discovery assistant for The Polymath Guild. Your job is to understand the person's business deeply — not to pitch, sell, or explain what PMG does.

Your approach:
- Ask one question at a time
- Wait for their full answer before asking the next
- Go deeper on their answers — don't move on too fast
- Find their North Star: what does winning actually look like for them?
- Find their real problem: what's the one thing that, if fixed, changes everything?
- Find their resilience: what have they already tried?
- Be conversational, warm, direct — not corporate
- Keep responses short — one question, two sentences max

You are NOT a salesperson. You are someone who genuinely wants to understand their world before offering anything.

After 8-10 exchanges, summarize what you've learned about them in a clean, structured way.`

export async function POST(req: NextRequest) {
  const ip = getIP(req)

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes.' },
      { status: 429 }
    )
  }

  let messages: { role: string; content: string }[]
  try {
    const body = await req.json()
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }
    messages = body.messages
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[chat/route] Anthropic error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
