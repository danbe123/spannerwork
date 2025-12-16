import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

import CookieConsent from './CookieConsent'

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  async function renderAndShowBanner() {
    render(<CookieConsent />)
    act(() => {
      vi.runAllTimers()
    })
    await act(async () => {})
  }

  it('shows the banner after delay and accepts all', async () => {
    await renderAndShowBanner()

    const accept = screen.getByRole('button', { name: /accept all cookies/i })
    fireEvent.click(accept)

    const saved = localStorage.getItem('cookieConsent')
    expect(saved).toBeTruthy()
    const obj = JSON.parse(saved || '{}')
    expect(obj.necessary).toBe(true)
    expect(obj.analytics).toBe(true)
    expect(obj.marketing).toBe(true)
  })

  it('rejects all cookies', async () => {
    await renderAndShowBanner()

    fireEvent.click(screen.getByRole('button', { name: /reject all/i }))

    const saved = localStorage.getItem('cookieConsent')
    expect(saved).toBeTruthy()
    const obj = JSON.parse(saved || '{}')
    expect(obj.necessary).toBe(true)
    expect(obj.analytics).toBe(false)
    expect(obj.marketing).toBe(false)
  })

  it('customizes preferences and saves', async () => {
    await renderAndShowBanner()

    fireEvent.click(screen.getByRole('button', { name: /customize/i }))
    expect(screen.getByText(/Cookie Preferences/i)).toBeInTheDocument()

    // Toggle Analytics off
    const analyticsRow = screen.getByText(/Analytics Cookies/i).closest('div.flex')
    if (!analyticsRow) throw new Error('Analytics row not found')
    const analyticsToggle = analyticsRow.querySelector('button')
    if (!analyticsToggle) throw new Error('Analytics toggle not found')
    fireEvent.click(analyticsToggle)

    // Toggle Marketing off
    const marketingRow = screen.getByText(/Marketing Cookies/i).closest('div.flex')
    if (!marketingRow) throw new Error('Marketing row not found')
    const marketingToggle = marketingRow.querySelector('button')
    if (!marketingToggle) throw new Error('Marketing toggle not found')
    fireEvent.click(marketingToggle)

    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))

    const saved = localStorage.getItem('cookieConsent')
    expect(saved).toBeTruthy()
    const obj = JSON.parse(saved || '{}')
    expect(obj.necessary).toBe(true)
    expect(obj.analytics).toBe(false)
    expect(obj.marketing).toBe(false)
  })
})
