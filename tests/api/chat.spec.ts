import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────
// CHAT API — /api/chat
// Tests the core discovery chat endpoint
// ─────────────────────────────────────────────

const BASE = 'http://localhost:3000'

test.describe('/api/chat', () => {

  test('returns a reply for a valid message', async ({ request }) => {
    const res = await request.post(`${BASE}/api/chat`, {
      data: {
        messages: [
          { role: 'user', content: 'Hi, my name is John and I run a landscaping business.' }
        ]
      }
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.reply).toBeTruthy()
    expect(typeof body.reply).toBe('string')
    expect(body.reply.length).toBeGreaterThan(0)
  })

  test('returns 400 for missing messages field', async ({ request }) => {
    const res = await request.post(`${BASE}/api/chat`, {
      data: {}
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('returns 400 for empty messages array', async ({ request }) => {
    const res = await request.post(`${BASE}/api/chat`, {
      data: { messages: [] }
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('returns 400 for malformed body', async ({ request }) => {
    const res = await request.post(`${BASE}/api/chat`, {
      headers: { 'Content-Type': 'application/json' },
      data: 'not-valid-json'
    })
    expect(res.status()).toBe(400)
  })

  test('returns 429 after rate limit is exceeded', async ({ request }) => {
    // Fire 21 requests — 21st should hit the rate limit
    let lastStatus = 200
    for (let i = 0; i < 21; i++) {
      const res = await request.post(`${BASE}/api/chat`, {
        data: {
          messages: [{ role: 'user', content: `Message number ${i}` }]
        }
      })
      lastStatus = res.status()
      if (lastStatus === 429) break
    }
    expect(lastStatus).toBe(429)
  })

})
