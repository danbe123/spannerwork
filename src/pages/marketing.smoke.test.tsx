import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import Home from './Home'
import HowItWorks from './HowItWorks'
import Pricing from './Pricing'
import Safety from './Safety'
import StartEarning from './StartEarning'
import SuccessStories from './SuccessStories'
import Resources from './Resources'
import About from './About'
import Contact from './Contact'
import Terms from './Terms'
import Privacy from './Privacy'
import Cookies from './Cookies'
import RefundPolicy from './RefundPolicy'

vi.mock('@/api/services', () => ({
  statsService: { getPublicStats: vi.fn().mockResolvedValue({}) },
}))

function wrap(ui, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Marketing pages smoke', () => {
  it('Home renders without crashing', () => {
    const { container } = wrap(<Home />)
    expect(container.firstChild).toBeTruthy()
  })
  it('HowItWorks renders without crashing', () => {
    const { container } = wrap(<HowItWorks />)
    expect(container.firstChild).toBeTruthy()
  })
  it('Pricing renders without crashing', () => {
    const { container } = wrap(<Pricing />)
    expect(container.firstChild).toBeTruthy()
  })
  it('Safety renders without crashing', () => {
    const { container } = wrap(<Safety />)
    expect(container.firstChild).toBeTruthy()
  })
  it('StartEarning renders without crashing', () => {
    const { container } = wrap(<StartEarning />)
    expect(container.firstChild).toBeTruthy()
  })
  it('SuccessStories renders without crashing', () => {
    const { container } = wrap(<SuccessStories />)
    expect(container.firstChild).toBeTruthy()
  })
  it('Resources renders without crashing', () => {
    const { container } = wrap(<Resources />)
    expect(container.firstChild).toBeTruthy()
  })
  it('About renders without crashing', () => {
    const { container } = wrap(<About />)
    expect(container.firstChild).toBeTruthy()
  })
  it('Contact renders without crashing', () => {
    const { container } = wrap(<Contact />)
    expect(container.firstChild).toBeTruthy()
  })
  it('Terms renders without crashing', () => {
    const { container } = wrap(<Terms />)
    expect(container.firstChild).toBeTruthy()
  })
  it('Privacy renders without crashing', () => {
    const { container } = wrap(<Privacy />)
    expect(container.firstChild).toBeTruthy()
  })
  it('Cookies renders without crashing', () => {
    const { container } = wrap(<Cookies />)
    expect(container.firstChild).toBeTruthy()
  })
  it('RefundPolicy renders without crashing', () => {
    const { container } = wrap(<RefundPolicy />)
    expect(container.firstChild).toBeTruthy()
  })
})

