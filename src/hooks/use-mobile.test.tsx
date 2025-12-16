import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useIsMobile } from './use-mobile'

function Probe() {
  const isMobile = useIsMobile()
  return <div data-testid="m">{String(isMobile)}</div>
}

describe('useIsMobile', () => {
  it('reflects current innerWidth threshold', () => {
    const original = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 600 })
    const { unmount } = render(<Probe />)
    expect(screen.getByTestId('m').textContent).toBe('true')
    unmount()

    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 })
    render(<Probe />)
    expect(screen.getByTestId('m').textContent).toBe('false')

    Object.defineProperty(window, 'innerWidth', { writable: true, value: original })
  })
})

