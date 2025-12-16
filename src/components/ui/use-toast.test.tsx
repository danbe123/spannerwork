import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

describe('use-toast', () => {
  it('reducer handles add/update/dismiss/remove actions', async () => {
    vi.resetModules()
    const mod = await import('./use-toast')

    const { reducer } = mod

    const initial = { toasts: [] as Array<{ id: string; open?: boolean; title?: string }> }

    const added = reducer(initial, {
      type: 'ADD_TOAST',
      toast: { id: 't1', title: 'Hello', open: true },
    })

    expect(added.toasts).toHaveLength(1)
    expect(added.toasts[0]).toEqual(expect.objectContaining({ id: 't1', title: 'Hello', open: true }))

    const updated = reducer(added, {
      type: 'UPDATE_TOAST',
      toast: { id: 't1', open: false },
    })

    expect(updated.toasts[0]).toEqual(expect.objectContaining({ id: 't1', title: 'Hello', open: false }))

    const dismissedOne = reducer(
      { toasts: [{ id: 't1', open: true }, { id: 't2', open: true }] },
      { type: 'DISMISS_TOAST', toastId: 't1' }
    )

    expect(dismissedOne.toasts.find((t) => t.id === 't1')?.open).toBe(false)
    expect(dismissedOne.toasts.find((t) => t.id === 't2')?.open).toBe(true)

    const dismissedAll = reducer(
      { toasts: [{ id: 't1', open: true }, { id: 't2', open: true }] },
      { type: 'DISMISS_TOAST' }
    )

    expect(dismissedAll.toasts.every((t) => t.open === false)).toBe(true)

    const removedOne = reducer(
      { toasts: [{ id: 't1' }, { id: 't2' }] },
      { type: 'REMOVE_TOAST', toastId: 't1' }
    )

    expect(removedOne.toasts.map((t) => t.id)).toEqual(['t2'])

    const removedAll = reducer({ toasts: [{ id: 't1' }] }, { type: 'REMOVE_TOAST' })
    expect(removedAll.toasts).toEqual([])
  })

  it('toast() integrates with useToast hook: add, onOpenChange dismiss, and timed removal', async () => {
    vi.useFakeTimers()
    vi.resetModules()

    const mod = await import('./use-toast')

    const { result } = renderHook(() => mod.useToast())

    await act(async () => {})

    act(() => {
      mod.toast({ title: 'Hello' })
    })

    await act(async () => {})
    expect(result.current.toasts).toHaveLength(1)

    const t = result.current.toasts[0]
    expect(t.open).toBe(true)

    act(() => {
      t.onOpenChange?.(false)
    })

    await act(async () => {})
    expect(result.current.toasts[0]?.open).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(1_000_000)
    })

    await act(async () => {})
    expect(result.current.toasts).toHaveLength(0)

    vi.useRealTimers()
  })
})
