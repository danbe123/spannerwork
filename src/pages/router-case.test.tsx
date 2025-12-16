import { describe, it, expect } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

describe('React Router case sensitivity', () => {
  it('matches lower-case URL to PascalCase route', () => {
    render(
      <MemoryRouter initialEntries={['/feed']}>
        <Routes>
          <Route path="/Feed" element={<div data-testid="hit">Hit</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('hit')).toBeInTheDocument()
  })
})
