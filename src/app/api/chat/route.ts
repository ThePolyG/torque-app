import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
  const { messages } = await req.json()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const reply = response.content[0].type === 'text' ? response.content[0].text : ''
  return NextResponse.json({ reply })
}
