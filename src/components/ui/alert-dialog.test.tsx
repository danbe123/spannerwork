import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './alert-dialog'

describe('alert-dialog', () => {
  it('opens via trigger, renders content, and supports cancel/action', async () => {
    const user = userEvent.setup()

    if (!('ResizeObserver' in globalThis)) {
      ;(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }

    render(
      <AlertDialog>
        <AlertDialogTrigger>Open</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm</AlertDialogTitle>
            <AlertDialogDescription>Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )

    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()

    await user.click(screen.getByText('Open'))

    expect(await screen.findByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Confirm')).not.toBeInTheDocument()
  })
})
