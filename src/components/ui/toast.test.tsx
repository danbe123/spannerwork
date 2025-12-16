import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from './toast'

describe('toast ui components', () => {
  it('renders provider, viewport, and toast content (default + destructive variants)', () => {
    const { rerender } = render(
      <ToastProvider>
        <ToastViewport />
        <Toast>
          <div>
            <ToastTitle>Title</ToastTitle>
            <ToastDescription>Description</ToastDescription>
          </div>
          <ToastAction>Action</ToastAction>
          <ToastClose aria-label="Close" />
        </Toast>
      </ToastProvider>
    )

    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()

    rerender(
      <ToastProvider>
        <ToastViewport />
        <Toast variant="destructive">
          <div>
            <ToastTitle>Bad</ToastTitle>
          </div>
          <ToastClose aria-label="Close" />
        </Toast>
      </ToastProvider>
    )

    const toastEl = screen.getByText('Bad').closest('div.destructive')
    expect(toastEl).toBeTruthy()
  })
})
