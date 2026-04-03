'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

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

      {/* SPLINE WORLD — full screen */}
      <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <Spline scene="https://prod.spline.design/jAe6bg4MRe9H0Wd4/scene.splinecode" />
      </div>

      {/* HUD — TOP RIGHT — date + live indicator */}
      <div style={{
        position: 'fixed',
        top: '16px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: "'Courier New', monospace",
        fontSize: '11px',
        color: '#4a9eff',
        letterSpacing: '0.08em',
        zIndex: 100,
      }}>
        <span>{dateStr}</span>
        <span style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: blink ? '#00d4aa' : 'transparent',
          boxShadow: blink ? '0 0 6px #00d4aa' : 'none',
          transition: 'background 0.15s, box-shadow 0.15s',
          display: 'inline-block',
        }} />
      </div>

      {/* HUD — BOTTOM BAR */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '36px',
        background: 'rgba(4, 6, 14, 0.82)',
        borderTop: '1px solid #0d1628',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '40px',
        zIndex: 100,
        fontFamily: "'Courier New', monospace",
        fontSize: '11px',
        letterSpacing: '0.1em',
      }}>
        <span style={{ color: '#4a9eff' }}>
          OPERATOR: <span style={{ color: '#00d4aa' }}>CHRIS ANDRADE</span>
        </span>
        <span style={{ color: '#0d1628', userSelect: 'none' }}>|</span>
        <span style={{ color: '#4a9eff' }}>
          SYSTEM: <span style={{ color: '#00d4aa' }}>TORQUE OS</span>
        </span>
        <span style={{ color: '#0d1628', userSelect: 'none' }}>|</span>
        <span style={{ color: '#4a9eff' }}>
          STATUS: <span style={{ color: '#2ecc71' }}>ACTIVE</span>
        </span>
        <span style={{ color: '#0d1628', userSelect: 'none' }}>|</span>
        <span style={{ color: '#4a9eff' }}>
          VERSION: <span style={{ color: '#00d4aa' }}>V1.0</span>
        </span>
      </div>

    </main>
  )
}
