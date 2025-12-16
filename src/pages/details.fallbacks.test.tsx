import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import ToolDetail from './ToolDetail'
import SpaceDetail from './SpaceDetail'
import ServiceDetail from './ServiceDetail'
import RequestDetail from './RequestDetail'

function wrap(ui: React.ReactElement, route: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  window.history.pushState({}, '', route)
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Detail pages not found fallbacks', () => {
  it('ToolDetail shows missing ID without id', async () => {
    wrap(<ToolDetail />, '/tool')
    expect(await screen.findByText(/Missing Tool ID/i)).toBeInTheDocument()
  })
  it('SpaceDetail shows missing ID without id', async () => {
    wrap(<SpaceDetail />, '/space')
    expect(await screen.findByText(/Missing Space ID/i)).toBeInTheDocument()
  })
  it('ServiceDetail shows missing ID without id', async () => {
    wrap(<ServiceDetail />, '/service')
    expect(await screen.findByText(/Missing Service ID/i)).toBeInTheDocument()
  })
  it('RequestDetail shows not found without id', async () => {
    wrap(<RequestDetail />, '/RequestDetail')
    expect(await screen.findByText(/Request Not Found/i)).toBeInTheDocument()
  })
})

