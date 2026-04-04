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

export async function POST(req: NextRequest) {
  const ip = getIP(req)

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before sending another transcript.' },
      { status: 429 }
    )
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { email, messages } = await req.json()

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
}
