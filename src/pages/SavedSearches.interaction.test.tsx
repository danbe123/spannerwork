import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import SavedSearches from './SavedSearches.jsx'

vi.mock('@/api/services', () => ({
  authService: { getCurrentUser: vi.fn().mockResolvedValue({ user: { id: 'u1' } }) },
  savedSearchesService: {
    list: vi.fn().mockResolvedValue({ savedSearches: [] }),
    create: vi.fn().mockResolvedValue({ id: 's1' }),
  },
}))

const { savedSearchesService } = await import('@/api/services')

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SavedSearches />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SavedSearches interactions', () => {
  it('creates a new saved search when required fields filled', async () => {
    wrap()

    // Open form
    const newBtn = await screen.findByRole('button', { name: /new search/i })
    fireEvent.click(newBtn)

    // Fill fields
    fireEvent.change(screen.getByPlaceholderText(/e\.g\., Weekend Table Saw/i), { target: { value: 'My Search' } })
    fireEvent.change(screen.getByPlaceholderText(/e\.g\., table saw/i), { target: { value: 'table saw' } })

    // Click create
    const create = screen.getByRole('button', { name: /save search/i })
    fireEvent.click(create)

    // mutation is async; wait for it to be observed
    await new Promise((r) => setTimeout(r, 0))
    expect(savedSearchesService.create).toHaveBeenCalled()
  })
})
