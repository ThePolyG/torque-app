'use client'

import { useEffect, useState, useCallback } from 'react'
import GoogleMapPicker, { LatLng } from './GoogleMapPicker'

// ─────────────────────────────────────────────────────────────────────────────
// CreateProfileModal — the "Get started — create your profile" wizard.
// Pops up on the landing page (dismissible). Does NOT touch the landing page
// content — it overlays on top. Submits to /api/create-profile which emails
// Chris (Resend) and (when configured) writes the lead to Google Sheets.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg: '#04060e', card: '#070d18', cardEdge: '#1a2a4a',
  blue: '#4a9eff', orange: '#FF9500', teal: '#00d4aa', green: '#2ecc71',
  text: '#e8f0ff', muted: '#9ec5ff', dim: '#6a8aba', err: '#ff7a7a',
  mono: "'Courier New', monospace",
}

type Category = {
  id: string; label: string; isMove: boolean
  followUp: { q: string; opts: string[] | null }
}

const CATEGORIES: Category[] = [
  { id: 'buildings', label: 'Buildings & Structures', isMove: false, followUp: { q: 'New, or help with an existing one?', opts: ['New purchase', 'Relocation / moving', 'Re-leveling', 'Repair', 'Delivery only', 'Not sure'] } },
  { id: 'transport', label: 'Transportation & Moving', isMove: true, followUp: { q: 'What needs moving?', opts: ['Shed / building', 'Container', 'Equipment', 'Other'] } },
  { id: 'land', label: 'Land & Property', isMove: false, followUp: { q: 'What kind of land / property help?', opts: ['Topo survey / drone mapping', 'Drainage consult ("where\'s my water going?")', 'Site assessment', 'Inspection', 'As-built documentation', 'Homestead consult', 'Not sure'] } },
  { id: 'construction', label: 'Construction & Trades', isMove: false, followUp: { q: "What's the project?", opts: ['Concrete / pad / foundation', 'Re-leveling', 'Deck / patio', 'Renovation / repair', 'Custom build', 'Not sure'] } },
  { id: 'print', label: 'Print & Fabrication', isMove: false, followUp: { q: 'What do you need?', opts: ['Large-format printing', 'Signage', 'Custom engraving', 'Banners / displays', 'Not sure'] } },
  { id: 'tech', label: 'Technology & Systems', isMove: false, followUp: { q: "What are you after?", opts: ['Voice agent', 'Website', 'Business automation / AIOS', 'QR / lead-capture system', 'CRM setup', 'Digital twin / virtual tour', 'Hardware install', 'Not sure'] } },
  { id: 'consult', label: 'Consulting — "I have a problem"', isMove: false, followUp: { q: 'Tell us what you need', opts: null } },
  { id: 'other', label: 'Other / Not sure', isMove: false, followUp: { q: 'Tell us what you need', opts: null } },
]

const TIMELINES = ['ASAP', 'This month', '1–3 months', '3–6 months', 'Just exploring']
const CONTACT_METHODS = ['Call', 'Text', 'Email']
const CONTACT_TIMES = ['Morning', 'Afternoon', 'Evening', 'Anytime']
const REFERRALS = ['Google search', 'Saw a sign or lot', 'Referred by a partner', 'Word of mouth', 'Social media', 'Other']
const BUDGETS = ['Under $1k', '$1k – $5k', '$5k – $15k', '$15k – $50k', '$50k+', 'Not sure']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STEPS = ['Welcome', 'Contact', 'What you need', 'Where', 'Timeline', 'Details', 'About you', 'Review', 'Done'] as const

type Form = {
  name: string; email: string; phone: string
  contactMethod: string; contactTime: string
  categoryId: string; followUpAnswer: string; followUpText: string
  origin: LatLng | null; destination: LatLng | null; distanceMiles: number | null
  timeline: string
  details: string; photos: File[]
  referral: string; budget: string
}

const EMPTY: Form = {
  name: '', email: '', phone: '', contactMethod: '', contactTime: '',
  categoryId: '', followUpAnswer: '', followUpText: '',
  origin: null, destination: null, distanceMiles: null,
  timeline: '', details: '', photos: [], referral: '', budget: '',
}

export default function CreateProfileModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [f, setF] = useState<Form>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setF(prev => {
      const next: Form = { ...prev }
      next[k] = v
      return next
    })
  }

  // Open on first load (unless dismissed this session). Re-prompt on exit-intent.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismissed = sessionStorage.getItem('pmg_profile_dismissed')
    if (!dismissed) {
      const t = setTimeout(() => setOpen(true), 250) // tiny delay so Spline starts first
      return () => clearTimeout(t)
    }
    // exit-intent re-prompt
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && sessionStorage.getItem('pmg_profile_dismissed') && !sessionStorage.getItem('pmg_profile_submitted')) {
        setOpen(true)
      }
    }
    document.addEventListener('mouseout', onLeave)
    return () => document.removeEventListener('mouseout', onLeave)
  }, [])

  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') sessionStorage.setItem('pmg_profile_dismissed', '1')
    setOpen(false)
  }, [])

  const category = CATEGORIES.find(c => c.id === f.categoryId) || null
  const isMove = !!category && (category.isMove || /relocat|moving/i.test(f.followUpAnswer))

  const canAdvance = (): boolean => {
    if (step === 1) return f.name.trim().length > 1 && EMAIL_RE.test(f.email) && f.phone.trim().length >= 7
    if (step === 2) return !!f.categoryId && (category?.followUp.opts ? !!f.followUpAnswer : f.followUpText.trim().length > 2)
    return true
  }

  async function submit() {
    setSubmitting(true); setError('')
    try {
      const fd = new FormData()
      const payload = {
        name: f.name, email: f.email, phone: f.phone,
        contactMethod: f.contactMethod, contactTime: f.contactTime,
        category: category?.label || f.categoryId,
        detail: f.followUpAnswer || f.followUpText,
        origin: f.origin, destination: f.destination, distanceMiles: f.distanceMiles,
        timeline: f.timeline, notes: f.details, referral: f.referral, budget: f.budget,
        source: (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('source')) || 'thepolyg.com',
      }
      fd.append('payload', JSON.stringify(payload))
      f.photos.slice(0, 8).forEach((p, i) => fd.append(`photo${i}`, p, p.name))
      const r = await fetch('/api/create-profile', { method: 'POST', body: fd })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.ok === false) throw new Error(j.error || `Submit failed (${r.status})`)
      if (typeof window !== 'undefined') sessionStorage.setItem('pmg_profile_submitted', '1')
      setStep(8)
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Try again, or call us directly.')
    } finally { setSubmitting(false) }
  }

  if (!open) return null

  // ── styles ────────────────────────────────────────────────────────────────
  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(2,4,10,0.86)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: C.mono }
  const cardS: React.CSSProperties = { background: C.card, border: `1px solid ${C.cardEdge}`, borderRadius: 12, width: '100%', maxWidth: 540, maxHeight: '90vh', display: 'flex', flexDirection: 'column', color: C.text, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }
  const headS: React.CSSProperties = { padding: '14px 18px', borderBottom: `1px solid ${C.cardEdge}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
  const bodyS: React.CSSProperties = { padding: 20, overflowY: 'auto', flex: 1 }
  const footS: React.CSSProperties = { padding: '14px 18px', borderTop: `1px solid ${C.cardEdge}`, display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }
  const label: React.CSSProperties = { display: 'block', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.blue, marginBottom: 6, marginTop: 14 }
  const input: React.CSSProperties = { width: '100%', padding: 11, background: C.bg, border: `1px solid ${C.cardEdge}`, borderRadius: 8, color: C.text, fontSize: 15, fontFamily: C.mono }
  const btn: React.CSSProperties = { padding: '11px 22px', borderRadius: 999, fontFamily: C.mono, fontSize: 14, letterSpacing: '0.08em', fontWeight: 700, cursor: 'pointer', border: 'none', textTransform: 'uppercase' }
  const btnGold: React.CSSProperties = { ...btn, background: C.orange, color: C.bg }
  const btnGhost: React.CSSProperties = { ...btn, background: 'transparent', border: `1px solid ${C.cardEdge}`, color: C.muted }
  const chip = (on: boolean): React.CSSProperties => ({ display: 'inline-block', padding: '8px 14px', margin: '4px 6px 4px 0', borderRadius: 999, border: `1px solid ${on ? C.orange : C.cardEdge}`, background: on ? 'rgba(255,149,0,0.12)' : C.bg, color: on ? C.orange : C.muted, fontSize: 13, cursor: 'pointer', fontFamily: C.mono })

  const progressPct = Math.round((step / (STEPS.length - 1)) * 100)

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget && step !== 8) dismiss() }}>
      <div style={cardS}>
        <div style={headS}>
          <div style={{ fontSize: 12, letterSpacing: '0.2em', color: C.blue }}>THE POLYMATH GUILD · CREATE YOUR PROFILE</div>
          {step !== 8 && <button onClick={dismiss} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>}
        </div>

        {/* progress bar */}
        <div style={{ height: 3, background: C.bg }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: C.orange, transition: 'width .25s' }} />
        </div>

        <div style={bodyS}>
          {/* STEP 0 — Welcome */}
          {step === 0 && (
            <div style={{ textAlign: 'center', padding: '10px 4px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.orange, lineHeight: 1.3, marginBottom: 12 }}>We&apos;re the people you call<br />when you don&apos;t know who to call.</div>
              <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, marginBottom: 6 }}>
                Sheds. Containers. Construction. Transport. Topo &amp; land. Print. Voice agents &amp; automation.
                One team for the whole problem — from a technical install to &ldquo;where&apos;s my water going?&rdquo;
              </div>
              <div style={{ color: C.dim, fontSize: 13, marginTop: 14 }}>Two minutes. We&apos;ll reach out within 24 hours.</div>
            </div>
          )}

          {/* STEP 1 — Contact */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>How do we reach you?</div>
              <label style={{ ...label, marginTop: 6 }}>Name *</label>
              <input style={input} value={f.name} onChange={e => set('name', e.target.value)} placeholder="First and last" />
              <label style={label}>Email *</label>
              <input style={input} value={f.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" type="email" />
              <label style={label}>Phone *</label>
              <input style={input} value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 555-5555" type="tel" />
              <label style={label}>Best way to reach you</label>
              <div>{CONTACT_METHODS.map(m => <span key={m} style={chip(f.contactMethod === m)} onClick={() => set('contactMethod', m)}>{m}</span>)}</div>
              <label style={label}>Best time</label>
              <div>{CONTACT_TIMES.map(t => <span key={t} style={chip(f.contactTime === t)} onClick={() => set('contactTime', t)}>{t}</span>)}</div>
            </div>
          )}

          {/* STEP 2 — What you need */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>What can we help you with?</div>
              <label style={{ ...label, marginTop: 6 }}>Service</label>
              <select style={input} value={f.categoryId} onChange={e => { set('categoryId', e.target.value); set('followUpAnswer', ''); set('followUpText', '') }}>
                <option value="">— select —</option>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              {category && (
                <>
                  <label style={label}>{category.followUp.q}</label>
                  {category.followUp.opts ? (
                    <div>{category.followUp.opts.map(o => <span key={o} style={chip(f.followUpAnswer === o)} onClick={() => set('followUpAnswer', o)}>{o}</span>)}</div>
                  ) : (
                    <textarea style={{ ...input, minHeight: 90, resize: 'vertical' }} value={f.followUpText} onChange={e => set('followUpText', e.target.value)} placeholder="In a sentence or two — what do you need help with?" />
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 3 — Where (map picker) */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>{isMove ? 'Where is it — and where is it going?' : 'Where is it?'}</div>
              <div style={{ color: C.dim, fontSize: 12, marginBottom: 12 }}>Drop a pin — no address needed. {isMove ? 'Pin A = current location, Pin B = destination.' : ''}</div>
              <GoogleMapPicker
                mode={isMove ? 'move' : 'single'}
                onChange={({ origin, destination, distanceMiles }) => { set('origin', origin); set('destination', destination); set('distanceMiles', distanceMiles) }}
              />
            </div>
          )}

          {/* STEP 4 — Timeline */}
          {step === 4 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 10 }}>How soon do you need this?</div>
              <div>{TIMELINES.map(t => <span key={t} style={chip(f.timeline === t)} onClick={() => set('timeline', t)}>{t}</span>)}</div>
            </div>
          )}

          {/* STEP 5 — Details + photos */}
          {step === 5 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Anything else we should know?</div>
              <textarea style={{ ...input, minHeight: 100, resize: 'vertical', marginTop: 8 }} value={f.details} onChange={e => set('details', e.target.value)} placeholder="Optional — sizes, conditions, deadlines, context…" />
              <label style={label}>Got a photo of the building / site / project?</label>
              <input type="file" accept="image/*" multiple onChange={e => set('photos', Array.from(e.target.files || []).slice(0, 8))} style={{ ...input, padding: 9 }} />
              {f.photos.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {f.photos.map((p, i) => <img key={i} src={URL.createObjectURL(p)} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.cardEdge}` }} />)}
                </div>
              )}
            </div>
          )}

          {/* STEP 6 — About you (referral + budget) */}
          {step === 6 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>A couple more — both optional</div>
              <label style={{ ...label, marginTop: 6 }}>How did you hear about us?</label>
              <div>{REFERRALS.map(r => <span key={r} style={chip(f.referral === r)} onClick={() => set('referral', r)}>{r}</span>)}</div>
              <label style={label}>Rough budget (optional)</label>
              <div>{BUDGETS.map(b => <span key={b} style={chip(f.budget === b)} onClick={() => set('budget', b)}>{b}</span>)}</div>
            </div>
          )}

          {/* STEP 7 — Review */}
          {step === 7 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 10 }}>Look good?</div>
              <div style={{ fontSize: 13, lineHeight: 1.9, color: C.muted }}>
                <div><span style={{ color: C.blue }}>NAME:</span> {f.name}</div>
                <div><span style={{ color: C.blue }}>EMAIL:</span> {f.email}</div>
                <div><span style={{ color: C.blue }}>PHONE:</span> {f.phone}{f.contactMethod ? ` · prefers ${f.contactMethod}` : ''}{f.contactTime ? ` · ${f.contactTime}` : ''}</div>
                <div><span style={{ color: C.blue }}>NEED:</span> {category?.label}{(f.followUpAnswer || f.followUpText) ? ` — ${f.followUpAnswer || f.followUpText}` : ''}</div>
                {f.origin && <div><span style={{ color: C.blue }}>{isMove ? 'FROM:' : 'SITE:'}</span> {f.origin.lat.toFixed(5)}, {f.origin.lng.toFixed(5)}</div>}
                {f.destination && <div><span style={{ color: C.blue }}>TO:</span> {f.destination.lat.toFixed(5)}, {f.destination.lng.toFixed(5)}{f.distanceMiles != null ? ` (≈ ${f.distanceMiles.toFixed(1)} mi)` : ''}</div>}
                {f.timeline && <div><span style={{ color: C.blue }}>TIMELINE:</span> {f.timeline}</div>}
                {f.details && <div><span style={{ color: C.blue }}>NOTES:</span> {f.details}</div>}
                {f.photos.length > 0 && <div><span style={{ color: C.blue }}>PHOTOS:</span> {f.photos.length} attached</div>}
                {f.referral && <div><span style={{ color: C.blue }}>HEARD VIA:</span> {f.referral}</div>}
                {f.budget && <div><span style={{ color: C.blue }}>BUDGET:</span> {f.budget}</div>}
              </div>
              {error && <div style={{ color: C.err, fontSize: 13, marginTop: 12 }}>{error}</div>}
            </div>
          )}

          {/* STEP 8 — Confirmation */}
          {step === 8 && (
            <div style={{ textAlign: 'center', padding: '20px 8px' }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.green, margin: '10px 0' }}>You&apos;re in.</div>
              <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>
                Thanks, {f.name?.split(' ')[0] || 'friend'}. Chris will reach out within 24 hours — by {f.contactMethod ? f.contactMethod.toLowerCase() : 'phone'} {f.contactTime ? `(${f.contactTime.toLowerCase()})` : ''}.
              </div>
              <div style={{ color: C.dim, fontSize: 13, marginTop: 14, lineHeight: 1.7 }}>
                What happens next: we review what you sent, figure out exactly who handles it, and come back with a plan — not a runaround.
              </div>
            </div>
          )}
        </div>

        {/* footer nav */}
        <div style={footS}>
          {step === 0 ? (
            <button style={btnGhost} onClick={dismiss}>Skip for now</button>
          ) : step < 8 ? (
            <button style={btnGhost} onClick={() => setStep(s => Math.max(0, s - 1))}>← Back</button>
          ) : <span />}

          {step === 0 && <button style={btnGold} onClick={() => setStep(1)}>Let&apos;s go →</button>}
          {step >= 1 && step <= 6 && (
            <button style={{ ...btnGold, opacity: canAdvance() ? 1 : 0.4, cursor: canAdvance() ? 'pointer' : 'not-allowed' }} disabled={!canAdvance()} onClick={() => canAdvance() && setStep(s => s + 1)}>Next →</button>
          )}
          {step === 7 && (
            <button style={{ ...btnGold, opacity: submitting ? 0.5 : 1 }} disabled={submitting} onClick={submit}>{submitting ? 'Sending…' : 'Submit ✓'}</button>
          )}
          {step === 8 && <button style={btnGold} onClick={() => { setOpen(false) }}>Done</button>}
        </div>
      </div>
    </div>
  )
}
