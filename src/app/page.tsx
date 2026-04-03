'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const Spline = dynamic(() => import('@splinetool/react-spline'), { ssr: false })

export default function Home() {
  const [dateStr, setDateStr] = useState('')
  const [blink, setBlink] = useState(true)

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setDateStr(
        now.toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      )
    }
    update()
    const interval = setInterval(() => setBlink(b => !b), 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', background: '#04060e', overflow: 'hidden' }}>

      {/* SPLINE WORLD */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <Spline scene="https://prod.spline.design/jAe6bg4MRe9H0Wd4/scene.splinecode" />
      </div>

      {/* CENTER — TITLE + CTA */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '28px',
      }}>
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: '13px',
          letterSpacing: '0.35em',
          color: '#4a9eff',
          textTransform: 'uppercase',
        }}>
          THE POLYMATH GUILD
        </div>
        <Link href="/chat" style={{
          display: 'inline-block',
          padding: '20px 48px',
          border: '1px solid #FF9500',
          color: '#FF9500',
          fontFamily: "'Courier New', monospace",
          fontSize: '22px',
          letterSpacing: '0.18em',
          textDecoration: 'none',
          textTransform: 'uppercase',
          background: 'rgba(4, 6, 14, 0.75)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
        }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.background = '#FF9500'
            ;(e.target as HTMLElement).style.color = '#04060e'
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.background = 'rgba(4, 6, 14, 0.75)'
            ;(e.target as HTMLElement).style.color = '#FF9500'
          }}
        >
          HAVE A CONVERSATION
        </Link>
      </div>

      {/* LEFT HUD */}
      <div style={{
        position: 'fixed',
        left: '32px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        zIndex: 100,
        fontFamily: "'Courier New', monospace",
      }}>
        <div>
          <div style={{ color: '#4a9eff', fontSize: '10px', letterSpacing: '0.25em', marginBottom: '6px' }}>OPERATOR</div>
          <div style={{ color: '#FF9500', fontSize: '28px', fontWeight: 'bold', letterSpacing: '0.06em', lineHeight: 1.1 }}>CHRIS<br />ANDRADE</div>
        </div>
        <div>
          <div style={{ color: '#4a9eff', fontSize: '10px', letterSpacing: '0.25em', marginBottom: '6px' }}>SYSTEM</div>
          <div style={{ color: '#00d4aa', fontSize: '28px', fontWeight: 'bold', letterSpacing: '0.06em', lineHeight: 1.1 }}>TORQUE<br />OS</div>
        </div>
      </div>

      {/* RIGHT HUD */}
      <div style={{
        position: 'fixed',
        right: '32px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        zIndex: 100,
        fontFamily: "'Courier New', monospace",
        textAlign: 'right',
      }}>
        <div>
          <div style={{ color: '#4a9eff', fontSize: '10px', letterSpacing: '0.25em', marginBottom: '6px' }}>STATUS</div>
          <div style={{ color: '#2ecc71', fontSize: '28px', fontWeight: 'bold', letterSpacing: '0.06em', lineHeight: 1.1 }}>ACTIVE</div>
        </div>
        <div>
          <div style={{ color: '#4a9eff', fontSize: '10px', letterSpacing: '0.25em', marginBottom: '6px' }}>VERSION</div>
          <div style={{ color: '#FF9500', fontSize: '28px', fontWeight: 'bold', letterSpacing: '0.06em', lineHeight: 1.1 }}>V1.0</div>
        </div>
      </div>

      {/* TOP RIGHT — date + live dot */}
      <div style={{
        position: 'fixed', top: '16px', right: '20px',
        display: 'flex', alignItems: 'center', gap: '8px',
        fontFamily: "'Courier New', monospace", fontSize: '11px',
        color: '#4a9eff', letterSpacing: '0.08em', zIndex: 100,
      }}>
        <span>{dateStr}</span>
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: blink ? '#00d4aa' : 'transparent',
          boxShadow: blink ? '0 0 6px #00d4aa' : 'none',
          transition: 'background 0.15s, box-shadow 0.15s',
          display: 'inline-block',
        }} />
      </div>

      {/* BOTTOM BAR + RACING LIGHT CYCLES */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '28px',
        background: 'rgba(4, 6, 14, 0.6)', borderTop: '1px solid #0d1628',
        backdropFilter: 'blur(4px)', zIndex: 100, overflow: 'hidden',
      }}>
        <div className="race-cyan" />
        <div className="race-amber" />
      </div>

    </main>
  )
}
