import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('./use-toast', () => ({
  useToast: () => ({
    toasts: [
      {
        id: 't1',
        title: 'Hello',
        description: 'World',
        action: <button>Undo</button>,
      },
      {
        id: 't2',
        title: 'Only title',
      },
    ],
  }),
}))

import { Toaster } from './toaster'

describe('Toaster', () => {
  it('renders toasts from useToast', () => {
    render(<Toaster />)

    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('World')).toBeInTheDocument()
    expect(screen.getByText('Undo')).toBeInTheDocument()
    expect(screen.getByText('Only title')).toBeInTheDocument()
  })
})
