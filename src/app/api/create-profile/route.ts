import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import * as crypto from 'crypto'

// Use the Node runtime — we need `crypto` for the service-account JWT.
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// /api/create-profile — receives a "Create Your Profile" submission.
//  1. validates + rate-limits
//  2. emails Chris (Resend) with the lead + photo attachments  ← always works
//  3. appends a row to a Google Sheet (if GOOGLE_SERVICE_ACCOUNT_JSON +
//     PMG_LEADS_SHEET_ID are configured)                       ← best-effort
//  4. (v1.1) photos → Google Drive folder
//
// Env vars:
//   RESEND_API_KEY                 (already used by /api/send-transcript)
//   LEAD_NOTIFY_EMAIL              (defaults to chris@thepolyg.com)
//   GOOGLE_SERVICE_ACCOUNT_JSON    (the full service-account JSON as a string;
//                                   may also be base64 of that JSON)
//   PMG_LEADS_SHEET_ID             (the Google Sheet ID to append leads to)
//   PMG_LEADS_SHEET_TAB            (optional; defaults to "Leads")
// ─────────────────────────────────────────────────────────────────────────────

// ── rate limit (same pattern as send-transcript) ────────────────────────────
const rl = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const WINDOW_MS = 60 * 60 * 1000
function getIP(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}
function limited(ip: string) {
  const now = Date.now()
  const e = rl.get(ip)
  if (!e || now > e.resetAt) { rl.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return false }
  if (e.count >= RATE_LIMIT) return true
  e.count++; return false
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Payload = {
  name?: string; email?: string; phone?: string
  contactMethod?: string; contactTime?: string
  category?: string; detail?: string
  origin?: { lat: number; lng: number } | null
  destination?: { lat: number; lng: number } | null
  distanceMiles?: number | null
  timeline?: string; notes?: string; referral?: string; budget?: string; source?: string
}

// ── Google service-account access token via JWT bearer (no npm deps) ─────────
async function getGoogleAccessToken(scope: string): Promise<string | null> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) return null
  let saJson: any
  try {
    // accept either raw JSON or base64-of-JSON
    const decoded = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    saJson = JSON.parse(decoded)
  } catch { return null }
  const { client_email, private_key } = saJson || {}
  if (!client_email || !private_key) return null

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = { iss: client_email, scope, aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now }
  const b64url = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const signingInput = `${b64url(header)}.${b64url(claim)}`
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(private_key.replace(/\\n/g, '\n')).toString('base64url')
  const assertion = `${signingInput}.${signature}`

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
    const j = await r.json()
    return j.access_token || null
  } catch { return null }
}

async function appendLeadRow(p: Payload, photoCount: number): Promise<{ ok: boolean; detail: string }> {
  const sheetId = process.env.PMG_LEADS_SHEET_ID
  if (!sheetId) return { ok: false, detail: 'no_sheet_id' }
  const token = await getGoogleAccessToken('https://www.googleapis.com/auth/spreadsheets')
  if (!token) return { ok: false, detail: 'no_token' }
  const tab = process.env.PMG_LEADS_SHEET_TAB || 'Leads'
  const row = [
    new Date().toISOString(),
    p.name || '', p.email || '', p.phone || '', p.contactMethod || '', p.contactTime || '',
    p.category || '', p.detail || '',
    p.origin ? `${p.origin.lat},${p.origin.lng}` : '',
    p.destination ? `${p.destination.lat},${p.destination.lng}` : '',
    p.distanceMiles != null ? String(p.distanceMiles) : '',
    p.timeline || '', p.notes || '', p.referral || '', p.budget || '', p.source || '',
    photoCount ? `${photoCount} photo(s)` : '', 'NEW',
  ]
  try {
    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(tab)}!A:R:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [row] }) }
    )
    if (!r.ok) return { ok: false, detail: `sheets_${r.status}` }
    return { ok: true, detail: 'appended' }
  } catch (e: any) { return { ok: false, detail: `err:${String(e?.message || e).slice(0, 120)}` } }
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (limited(ip)) return NextResponse.json({ ok: false, error: 'Too many submissions — please wait a bit.' }, { status: 429 })

  // parse multipart
  let p: Payload = {}
  const photos: { filename: string; buf: Buffer }[] = []
  try {
    const fd = await req.formData()
    p = JSON.parse(String(fd.get('payload') || '{}'))
    for (let i = 0; i < 8; i++) {
      const file = fd.get(`photo${i}`)
      if (file && file instanceof File) {
        const buf = Buffer.from(await file.arrayBuffer())
        if (buf.length <= 8 * 1024 * 1024) photos.push({ filename: file.name || `photo${i}.jpg`, buf })
      }
    }
  } catch { return NextResponse.json({ ok: false, error: 'Invalid submission.' }, { status: 400 }) }

  if (!p.name || p.name.trim().length < 2) return NextResponse.json({ ok: false, error: 'Name is required.' }, { status: 400 })
  if (!p.email || !EMAIL_RE.test(p.email)) return NextResponse.json({ ok: false, error: 'A valid email is required.' }, { status: 400 })
  if (!p.phone || p.phone.trim().length < 7) return NextResponse.json({ ok: false, error: 'A phone number is required.' }, { status: 400 })

  // ── 1. Sheet (best-effort) ────────────────────────────────────────────────
  const sheet = await appendLeadRow(p, photos.length)

  // ── 2. Email Chris (Resend) — always ──────────────────────────────────────
  const to = process.env.LEAD_NOTIFY_EMAIL || 'chris@thepolyg.com'
  const apiKey = process.env.RESEND_API_KEY
  const row = (k: string, v?: string | null) => (v ? `<tr><td style="color:#4a9eff;padding:4px 12px 4px 0;vertical-align:top;white-space:nowrap">${k}</td><td style="color:#00d4aa;padding:4px 0">${v}</td></tr>` : '')
  const mapsLink = (c?: { lat: number; lng: number } | null) => (c ? `<a href="https://www.google.com/maps?q=${c.lat},${c.lng}" style="color:#FF9500">${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}</a>` : '')
  const html = `
    <div style="font-family:monospace;background:#04060e;color:#e8f0ff;padding:28px;max-width:640px">
      <h2 style="color:#FF9500;letter-spacing:.08em;margin:0 0 4px">NEW PROFILE — ${p.name}</h2>
      <div style="color:#4a9eff;font-size:12px;margin-bottom:16px">The Polymath Guild · thepolyg.com${p.source && p.source !== 'thepolyg.com' ? ` · source: ${p.source}` : ''}</div>
      <table style="font-size:14px;border-collapse:collapse">
        ${row('NAME', p.name)}${row('EMAIL', p.email ? `<a href="mailto:${p.email}" style="color:#00d4aa">${p.email}</a>` : '')}
        ${row('PHONE', p.phone ? `<a href="tel:${p.phone}" style="color:#00d4aa">${p.phone}</a>` : '')}${row('PREFERS', [p.contactMethod, p.contactTime].filter(Boolean).join(' · ') || null)}
        ${row('NEED', [p.category, p.detail].filter(Boolean).join(' — ') || null)}
        ${p.origin ? `<tr><td style="color:#4a9eff;padding:4px 12px 4px 0">${p.destination ? 'FROM' : 'SITE'}</td><td style="padding:4px 0">${mapsLink(p.origin)}</td></tr>` : ''}
        ${p.destination ? `<tr><td style="color:#4a9eff;padding:4px 12px 4px 0">TO</td><td style="padding:4px 0">${mapsLink(p.destination)}${p.distanceMiles != null ? ` <span style="color:#FF9500">(≈ ${p.distanceMiles.toFixed(1)} mi)</span>` : ''}</td></tr>` : ''}
        ${row('TIMELINE', p.timeline)}${row('NOTES', p.notes)}${row('HEARD VIA', p.referral)}${row('BUDGET', p.budget)}
        ${photos.length ? row('PHOTOS', `${photos.length} attached`) : ''}
        ${row('SHEET', sheet.ok ? '✓ appended to PMG Leads' : `not written (${sheet.detail})`)}
      </table>
      <div style="color:#6a8aba;font-size:11px;margin-top:18px">Reply within 24h — that's the white-glove standard.</div>
    </div>`

  let emailOk = false
  if (apiKey) {
    try {
      const resend = new Resend(apiKey)
      await resend.emails.send({
        from: 'PMG <onboarding@resend.dev>',
        to,
        subject: `New Profile — ${p.name} · ${p.category || 'general'}`,
        html,
        attachments: photos.slice(0, 4).map(ph => ({ filename: ph.filename, content: ph.buf })),
      })
      emailOk = true
    } catch (e) { console.error('[create-profile] resend error:', e) }
  } else {
    console.warn('[create-profile] RESEND_API_KEY not set — lead not emailed')
  }

  if (!emailOk && !sheet.ok) {
    return NextResponse.json({ ok: false, error: 'Could not save your profile right now. Please call us — we still want to help.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, emailed: emailOk, sheet: sheet.ok, sheetDetail: sheet.detail })
}
