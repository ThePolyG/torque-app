import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────
// SEND TRANSCRIPT API — /api/send-transcript
// Tests the email delivery endpoint
// ─────────────────────────────────────────────

const BASE = 'http://localhost:3000'

const VALID_MESSAGES = [
  { role: 'assistant', content: 'Welcome. Tell me about your business.' },
  { role: 'user', content: 'I run a landscaping company in Phoenix.' },
  { role: 'assistant', content: 'What does winning look like for you this year?' },
  { role: 'user', content: 'More repeat customers and fewer lost leads.' },
]

test.describe('/api/send-transcript', () => {

  test('returns 400 for missing email', async ({ request }) => {
    const res = await request.post(`${BASE}/api/send-transcript`, {
      data: { messages: VALID_MESSAGES }
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('email')
  })

  test('returns 400 for invalid email format', async ({ request }) => {
    const res = await request.post(`${BASE}/api/send-transcript`, {
      data: { email: 'not-an-email', messages: VALID_MESSAGES }
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('email')
  })

  test('returns 400 for empty messages array', async ({ request }) => {
    const res = await request.post(`${BASE}/api/send-transcript`, {
      data: { email: 'test@example.com', messages: [] }
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('returns 400 for missing messages field', async ({ request }) => {
    const res = await request.post(`${BASE}/api/send-transcript`, {
      data: { email: 'test@example.com' }
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  test('returns 400 for malformed body', async ({ request }) => {
    const res = await request.post(`${BASE}/api/send-transcript`, {
      headers: { 'Content-Type': 'application/json' },
      data: 'bad-json'
    })
    expect(res.status()).toBe(400)
  })

  // NOTE: Happy path (200 success) requires live Resend API key + valid domain.
  // Run manually against staging with real credentials.
  // test('returns 200 for valid email and messages', ...)

})
