import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────
// E2E — FULL CHAT FLOW
// Simulates a visitor landing, entering chat, having a conversation
// ─────────────────────────────────────────────

test.describe('Discovery chat — full user journey', () => {

  test('landing page loads and CTA is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('THE POLYMATH GUILD')).toBeVisible()
    await expect(page.getByText('HAVE A CONVERSATION')).toBeVisible()
  })

  test('CTA navigates to /chat', async ({ page }) => {
    await page.goto('/')
    await page.getByText('HAVE A CONVERSATION').click()
    await expect(page).toHaveURL('/chat')
  })

  test('chat page loads with welcome message', async ({ page }) => {
    await page.goto('/chat')
    await expect(page.getByText("Welcome. I'm here to understand your business")).toBeVisible()
  })

  test('user can type and send a message', async ({ page }) => {
    await page.goto('/chat')
    const input = page.locator('input[placeholder="Type your message..."]')
    await input.fill('Hi, I run a landscaping company in Phoenix.')
    await page.getByRole('button', { name: 'SEND' }).click()
    // User message should appear in chat
    await expect(page.getByText('Hi, I run a landscaping company in Phoenix.')).toBeVisible()
  })

  test('Enter key sends a message', async ({ page }) => {
    await page.goto('/chat')
    const input = page.locator('input[placeholder="Type your message..."]')
    await input.fill('Testing enter key send.')
    await input.press('Enter')
    await expect(page.getByText('Testing enter key send.')).toBeVisible()
  })

  test('send button is disabled while loading', async ({ page }) => {
    await page.goto('/chat')
    const input = page.locator('input[placeholder="Type your message..."]')
    const sendBtn = page.getByRole('button', { name: 'SEND' })
    await input.fill('Test message')
    await sendBtn.click()
    // Button should be disabled immediately after click
    await expect(sendBtn).toBeDisabled()
  })

  test('email capture appears after 6 messages', async ({ page }) => {
    await page.goto('/chat')
    const input = page.locator('input[placeholder="Type your message..."]')

    // Send 3 user messages (triggers after updated.length >= 6 — 1 initial + 3 user + 2 assistant replies)
    for (let i = 0; i < 3; i++) {
      await input.fill(`Message ${i + 1}`)
      await input.press('Enter')
      // Wait for assistant reply before next message
      await page.waitForTimeout(2000)
    }

    await expect(page.getByText('Want a copy of this conversation')).toBeVisible({ timeout: 15000 })
  })

})
