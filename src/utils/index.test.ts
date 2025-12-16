import { describe, it, expect } from 'vitest'
import { createPageUrl, mapPathToPageName } from './index'

describe('createPageUrl', () => {
  it('converts camel case names to kebab-case paths', () => {
    expect(createPageUrl('ResetPassword')).toBe('/reset-password')
  })

  it('normalizes spaces and preserves uppercase letters in the query string', () => {
    expect(createPageUrl('Start Transaction')).toBe('/start-transaction')
    expect(createPageUrl('Chat?userId=ABC123&requestId=XYZ')).toBe('/chat?userId=ABC123&requestId=XYZ')
  })

  it('returns root when no page name provided', () => {
    expect(createPageUrl('')).toBe('/')
  })
})

describe('mapPathToPageName', () => {
  const pageNames = ['Home', 'ResetPassword', 'TransactionDetail']

  it('returns Home for the root path', () => {
    expect(mapPathToPageName('/', pageNames)).toBe('Home')
  })

  it('matches hyphenated URLs to camel case page names', () => {
    expect(mapPathToPageName('/reset-password', pageNames)).toBe('ResetPassword')
  })

  it('falls back to Home when the path is unknown', () => {
    expect(mapPathToPageName('/does-not-exist', pageNames)).toBe('Home')
  })
})
