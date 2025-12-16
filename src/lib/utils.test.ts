import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges tailwind classes correctly', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
    expect(cn('hidden', 'block')).toBe('block')
  })

  it('handles falsy and conditional inputs', () => {
    const active = true
    const disabled = false
    expect(cn('px-2', active && 'text-white', disabled && 'opacity-50')).toBe('px-2 text-white')
  })
})

