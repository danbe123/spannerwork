import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { createFramerMotionMock, createHelmetMock } from './mockSetup'

describe('mockSetup', () => {
  it('createFramerMotionMock provides motion components and hooks', async () => {
    const fm = createFramerMotionMock()

    expect(typeof fm.useAnimation).toBe('function')
    expect(typeof fm.useMotionValue).toBe('function')
    expect(typeof fm.useTransform).toBe('function')
    expect(typeof fm.useSpring).toBe('function')
    expect(typeof fm.useInView).toBe('function')
    expect(typeof fm.useScroll).toBe('function')

    const controls = fm.useAnimation()
    await controls.start()
    controls.set()
    controls.stop()

    const mv = fm.useMotionValue(123)
    expect(mv.get()).toBe(123)
    mv.set()
    const unsubscribe = mv.onChange()
    unsubscribe()

    const t = fm.useTransform()
    expect(t.get()).toBe(0)
    t.set()

    const s = fm.useSpring()
    expect(s.get()).toBe(0)
    s.set()

    const scroll = fm.useScroll()
    expect(scroll.scrollY.get()).toBe(0)
    expect(scroll.scrollX.get()).toBe(0)
    expect(scroll.scrollYProgress.get()).toBe(0)
    expect(scroll.scrollXProgress.get()).toBe(0)

    render(
      <>
        <fm.motion.div data-testid="div">div</fm.motion.div>
        <fm.motion.button>btn</fm.motion.button>
        <fm.motion.form>form</fm.motion.form>
        <fm.motion.h1>h1</fm.motion.h1>
        <fm.motion.h2>h2</fm.motion.h2>
        <fm.motion.h3>h3</fm.motion.h3>
        <fm.motion.p>p</fm.motion.p>
        <fm.motion.span>span</fm.motion.span>
        <fm.motion.section>section</fm.motion.section>
        <fm.motion.article>article</fm.motion.article>
        <fm.motion.nav>nav</fm.motion.nav>
        <fm.motion.header>header</fm.motion.header>
        <fm.motion.footer>footer</fm.motion.footer>
        <fm.motion.main>main</fm.motion.main>
        <fm.motion.aside>aside</fm.motion.aside>
        <fm.motion.ul>
          <fm.motion.li>li</fm.motion.li>
        </fm.motion.ul>
        {/** motion.a/img are typed as MotionDivProps in mockSetup; cast to any to exercise the runtime wrappers */}
        {/** eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {((fm.motion as any).a as any)({ href: '#', children: 'link' })}
        {/** eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {((fm.motion as any).img as any)({ alt: 'img' })}
        <fm.AnimatePresence>
          <div>present</div>
        </fm.AnimatePresence>
      </>
    )

    expect(screen.getByTestId('div')).toBeInTheDocument()
    expect(screen.getByText('present')).toBeInTheDocument()
  })

  it('createHelmetMock provides Helmet and HelmetProvider wrappers', () => {
    const helmet = createHelmetMock()

    render(
      <helmet.HelmetProvider>
        <helmet.Helmet>
          <div>inside</div>
        </helmet.Helmet>
      </helmet.HelmetProvider>
    )

    expect(screen.getByText('inside')).toBeInTheDocument()
  })
})
