'use client'

import { useState, useRef, useEffect } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Welcome. I'm here to understand your business — not pitch you anything. Tell me your name and what you do.",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })
      const data = await res.json()
      if (!res.ok) {
        const errMsg = res.status === 429
          ? 'Too many messages. Please wait a few minutes.'
          : (data.error || 'Something went wrong. Try again.')
        setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }

      // After 6 messages — offer to send transcript
      if (updated.length >= 6) setShowEmail(true)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  const sendTranscript = async () => {
    if (!email.trim() || sending) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/send-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, messages }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error || 'Failed to send. Please try again.')
      } else {
        setSent(true)
      }
    } catch {
      setSendError('Network error. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main style={{
      width: '100vw', height: '100vh', background: '#04060e',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: "'Courier New', monospace", overflow: 'hidden',
    }}>

      {/* HEADER */}
      <div style={{
        width: '100%', borderBottom: '1px solid #0d1628',
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ color: '#4a9eff', fontSize: '11px', letterSpacing: '0.15em' }}>
          THE POLYMATH GUILD
        </span>
        <span style={{ color: '#00d4aa', fontSize: '11px', letterSpacing: '0.1em' }}>
          DISCOVERY SESSION
        </span>
      </div>

      {/* MESSAGES */}
      <div style={{
        flex: 1, width: '100%', maxWidth: '720px',
        overflowY: 'auto', padding: '32px 24px', display: 'flex',
        flexDirection: 'column', gap: '20px',
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '80%',
              padding: '12px 16px',
              background: m.role === 'user' ? 'rgba(74, 158, 255, 0.08)' : 'rgba(0, 212, 170, 0.06)',
              border: `1px solid ${m.role === 'user' ? '#0d1628' : '#0d2420'}`,
              color: m.role === 'user' ? '#4a9eff' : '#00d4aa',
              fontSize: '13px',
              lineHeight: '1.6',
              letterSpacing: '0.02em',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ color: '#4a9eff', fontSize: '12px', letterSpacing: '0.1em' }}>
            ···
          </div>
        )}

        {/* EMAIL CAPTURE */}
        {showEmail && !sent && (
          <div style={{
            border: '1px solid #0d1628', padding: '20px',
            background: 'rgba(4, 6, 14, 0.9)',
          }}>
            <p style={{ color: '#00d4aa', fontSize: '12px', marginBottom: '12px', letterSpacing: '0.05em' }}>
              Want a copy of this conversation sent to you and Chris?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  flex: 1, background: 'transparent', border: '1px solid #0d1628',
                  color: '#4a9eff', padding: '8px 12px', fontSize: '12px',
                  fontFamily: "'Courier New', monospace", outline: 'none',
                }}
              />
              <button onClick={sendTranscript} disabled={sending} style={{
                background: 'transparent', border: '1px solid #00d4aa',
                color: '#00d4aa', padding: '8px 16px', fontSize: '11px',
                fontFamily: "'Courier New', monospace", cursor: sending ? 'not-allowed' : 'pointer',
                letterSpacing: '0.1em', opacity: sending ? 0.5 : 1,
              }}>
                {sending ? '···' : 'SEND'}
              </button>
            </div>
            {sendError && (
              <p style={{ color: '#ff4444', fontSize: '11px', marginTop: '8px', letterSpacing: '0.04em' }}>
                {sendError}
              </p>
            )}
          </div>
        )}

        {sent && (
          <div style={{ color: '#2ecc71', fontSize: '12px', letterSpacing: '0.05em' }}>
            Sent. Chris will be in touch.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div style={{
        width: '100%', maxWidth: '720px', padding: '16px 24px',
        borderTop: '1px solid #0d1628', display: 'flex', gap: '10px', flexShrink: 0,
      }}>
        <input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          style={{
            flex: 1, background: 'transparent', border: '1px solid #0d1628',
            color: '#4a9eff', padding: '10px 14px', fontSize: '13px',
            fontFamily: "'Courier New', monospace", outline: 'none',
            letterSpacing: '0.02em',
          }}
        />
        <button onClick={send} disabled={loading} style={{
          background: 'transparent', border: '1px solid #4a9eff',
          color: '#4a9eff', padding: '10px 20px', fontSize: '11px',
          fontFamily: "'Courier New', monospace", cursor: 'pointer',
          letterSpacing: '0.1em', opacity: loading ? 0.4 : 1,
        }}>
          SEND
        </button>
      </div>

    </main>
  )
}
