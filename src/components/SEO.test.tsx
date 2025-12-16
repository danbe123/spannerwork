import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SEO, { generateLocalBusinessSchema, generateServiceSchema, generateProductSchema, generateReviewSchema, generateBreadcrumbSchema } from './SEO'

describe('SEO', () => {
  it('sets document title and meta tags', () => {
    render(<SEO title="T" description="D" keywords="K" url="http://example.com" />)
    expect(document.title).toBe('T')
    const desc = document.querySelector('meta[name="description"]')
    expect(desc?.getAttribute('content')).toBe('D')
    const canonical = document.querySelector('link[rel="canonical"]')
    expect(canonical?.getAttribute('href')).toBe('http://example.com')
  })

  it('injects structured data script tag', () => {
    render(<SEO schema={generateLocalBusinessSchema()} />)
    const script = document.querySelector('script[type="application/ld+json"]')
    expect(script).toBeTruthy()
  })
})

describe('SEO schema helpers', () => {
  it('service schema shape', () => {
    const s = generateServiceSchema('Name', 'Desc', 10)
    expect(s['@type']).toBe('Service')
  })
  it('product schema pulls price', () => {
    const p = generateProductSchema({ name: 'X', description: 'Y', dailyRate: 100, available: true }) as any
    expect(p.offers.price).toBe(100)
  })
  it('review schema maps fields', () => {
    const r = generateReviewSchema({ rating: 5, reviewerName: 'Al' }, 'Thing') as any
    expect(r.reviewRating.ratingValue).toBe(5)
  })
  it('breadcrumb schema maps items', () => {
    const b = generateBreadcrumbSchema([{ name: 'A', url: '/a' }, { name: 'B', url: '/b' }]) as any
    expect(b.itemListElement.length).toBe(2)
  })
})

