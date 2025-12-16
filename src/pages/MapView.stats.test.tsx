import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import MapView from './MapView'

// Mock react-leaflet to avoid DOM/Leaflet in jsdom
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => <div data-testid="tile" />,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ fitBounds: () => {} }),
}))

vi.mock('@/api/services', () => ({
  requestsService: {
    list: vi.fn().mockResolvedValue({
      data: [
        { id: 'r1', status: 'ACTIVE', category: 'tools', title: 'With coords', urgency: 'flexible', locationLat: 52, locationLng: -2 },
        { id: 'r2', status: 'ACTIVE', category: 'tools', title: 'No coords A', urgency: 'flexible' },
        { id: 'r3', status: 'ACTIVE', category: 'tools', title: 'No coords B', urgency: 'flexible' },
      ],
    }),
  },
  authService: { getCurrentUser: vi.fn().mockResolvedValue({ user: { id: 'u1' } }) },
}))

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MapView />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MapView stats', () => {
  it('shows one marker and warns about hidden without location', async () => {
    wrap()
    // One request with coords -> one marker rendered
    const markers = await screen.findAllByTestId('marker')
    expect(markers.length).toBe(1)
    expect(screen.getByText(/without location/i)).toBeInTheDocument()
  })
})
