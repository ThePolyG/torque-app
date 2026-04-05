import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

// Rate limiting — 3 transcript sends per IP per hour (prevents email spam)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 3
const WINDOW_MS = 60 * 60 * 1000 // 1 hour

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const ip = getIP(req)

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before sending another transcript.' },
      { status: 429 }
    )
  }

  let email: string
  let messages: { role: string; content: string }[]
  try {
    const body = await req.json()
    email = body.email
    messages = body.messages

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No transcript to send.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const transcript = messages
    .map((m: { role: string; content: string }) =>
      `${m.role === 'user' ? 'VISITOR' : 'PMG'}: ${m.content}`
    )
    .join('\n\n')

  const html = `
    <div style="font-family: monospace; background: #04060e; color: #00d4aa; padding: 32px; max-width: 600px;">
      <h2 style="color: #4a9eff; letter-spacing: 0.1em;">DISCOVERY SESSION TRANSCRIPT</h2>
      <p style="color: #4a9eff; font-size: 12px;">The Polymath Guild — TORQUE OS</p>
      <hr style="border-color: #0d1628; margin: 24px 0;" />
      <pre style="color: #00d4aa; font-size: 13px; line-height: 1.8; white-space: pre-wrap;">${transcript}</pre>
      <hr style="border-color: #0d1628; margin: 24px 0;" />
      <p style="color: #4a9eff; font-size: 11px;">thepolyg.com</p>
    </div>
  `

  try {
    // Send to visitor
    await resend.emails.send({
      from: 'PMG <onboarding@resend.dev>',
      to: email,
      subject: 'Your Discovery Session — The Polymath Guild',
      html,
    })

    // Send to Chris
    await resend.emails.send({
      from: 'PMG <onboarding@resend.dev>',
      to: 'chris@thepolyg.com',
      subject: `New Discovery Session — ${email}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[send-transcript/route] Resend error:', err)
    return NextResponse.json(
      { error: 'Failed to send transcript. Please try again.' },
      { status: 500 }
    )
  }
}
