import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fadeIn,
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  scaleInBounce,
  popIn,
  slideInFromBottom,
  slideInFromTop,
  slideInFromLeft,
  slideInFromRight,
  staggerContainer,
  staggerContainerFast,
  staggerContainerSlow,
  staggerChild,
  staggerChildScale,
  staggerChildSlide,
  hoverScale,
  hoverScaleLarge,
  hoverLift,
  hoverGlow,
  tapScale,
  tapScaleSmall,
  pulseAnimation,
  shimmerAnimation,
  spinAnimation,
  bounceAnimation,
  pageTransition,
  pageTransitionFade,
  modalBackdrop,
  modalContent,
  modalSlideUp,
  notificationSlide,
  toastAnimation,
  skeletonPulse,
  successCheckmark,
  confettiPop,
  getStaggerDelay,
  getSpringConfig,
  triggerHaptic,
} from './animations'

describe('Animation Variants', () => {
  describe('Fade Animations', () => {
    it('fadeIn has correct initial, animate, and exit states', () => {
      expect(fadeIn.initial).toEqual({ opacity: 0 })
      expect(fadeIn.animate).toEqual({ opacity: 1 })
      expect(fadeIn.exit).toEqual({ opacity: 0 })
    })

    it('fadeInUp animates from below', () => {
      expect(fadeInUp.initial).toEqual({ opacity: 0, y: 20 })
      expect(fadeInUp.animate).toEqual({ opacity: 1, y: 0 })
      expect(fadeInUp.exit).toEqual({ opacity: 0, y: -10 })
    })

    it('fadeInDown animates from above', () => {
      expect(fadeInDown.initial).toEqual({ opacity: 0, y: -20 })
      expect(fadeInDown.animate).toEqual({ opacity: 1, y: 0 })
      expect(fadeInDown.exit).toEqual({ opacity: 0, y: 10 })
    })

    it('fadeInLeft animates from the left', () => {
      expect(fadeInLeft.initial).toEqual({ opacity: 0, x: -20 })
      expect(fadeInLeft.animate).toEqual({ opacity: 1, x: 0 })
      expect(fadeInLeft.exit).toEqual({ opacity: 0, x: 20 })
    })

    it('fadeInRight animates from the right', () => {
      expect(fadeInRight.initial).toEqual({ opacity: 0, x: 20 })
      expect(fadeInRight.animate).toEqual({ opacity: 1, x: 0 })
      expect(fadeInRight.exit).toEqual({ opacity: 0, x: -20 })
    })
  })

  describe('Scale Animations', () => {
    it('scaleIn scales from 0.9', () => {
      expect(scaleIn.initial).toEqual({ opacity: 0, scale: 0.9 })
      expect(scaleIn.animate).toEqual({ opacity: 1, scale: 1 })
      expect(scaleIn.exit).toEqual({ opacity: 0, scale: 0.9 })
    })

    it('scaleInBounce scales from 0.5 with spring transition', () => {
      expect(scaleInBounce.initial).toEqual({ opacity: 0, scale: 0.5 })
      expect(scaleInBounce.animate).toMatchObject({
        opacity: 1,
        scale: 1,
        transition: expect.objectContaining({ type: 'spring' }),
      })
    })

    it('popIn has spring transition', () => {
      expect(popIn.initial).toEqual({ opacity: 0, scale: 0.8 })
      expect(popIn.animate).toMatchObject({
        opacity: 1,
        scale: 1,
        transition: expect.objectContaining({ type: 'spring' }),
      })
    })
  })

  describe('Slide Animations', () => {
    it('slideInFromBottom slides up from 100%', () => {
      expect(slideInFromBottom.initial).toEqual({ y: '100%' })
      expect(slideInFromBottom.animate).toEqual({ y: 0 })
      expect(slideInFromBottom.exit).toEqual({ y: '100%' })
      expect(slideInFromBottom.transition).toMatchObject({ type: 'spring' })
    })

    it('slideInFromTop slides down from -100%', () => {
      expect(slideInFromTop.initial).toEqual({ y: '-100%' })
      expect(slideInFromTop.animate).toEqual({ y: 0 })
      expect(slideInFromTop.exit).toEqual({ y: '-100%' })
    })

    it('slideInFromLeft slides right from -100%', () => {
      expect(slideInFromLeft.initial).toEqual({ x: '-100%' })
      expect(slideInFromLeft.animate).toEqual({ x: 0 })
      expect(slideInFromLeft.exit).toEqual({ x: '-100%' })
    })

    it('slideInFromRight slides left from 100%', () => {
      expect(slideInFromRight.initial).toEqual({ x: '100%' })
      expect(slideInFromRight.animate).toEqual({ x: 0 })
      expect(slideInFromRight.exit).toEqual({ x: '100%' })
    })
  })

  describe('Stagger Container Variants', () => {
    it('staggerContainer has proper stagger children config', () => {
      expect(staggerContainer.hidden).toEqual({ opacity: 0 })
      expect(staggerContainer.visible).toMatchObject({
        opacity: 1,
        transition: {
          staggerChildren: 0.1,
          delayChildren: 0.1,
        },
      })
    })

    it('staggerContainerFast has faster stagger timing', () => {
      expect(staggerContainerFast.visible).toMatchObject({
        transition: {
          staggerChildren: 0.05,
          delayChildren: 0.05,
        },
      })
    })

    it('staggerContainerSlow has slower stagger timing', () => {
      expect(staggerContainerSlow.visible).toMatchObject({
        transition: {
          staggerChildren: 0.15,
          delayChildren: 0.2,
        },
      })
    })
  })

  describe('Stagger Child Variants', () => {
    it('staggerChild fades and slides up', () => {
      expect(staggerChild.hidden).toEqual({ opacity: 0, y: 20 })
      expect(staggerChild.visible).toMatchObject({
        opacity: 1,
        y: 0,
      })
    })

    it('staggerChildScale fades and scales', () => {
      expect(staggerChildScale.hidden).toEqual({ opacity: 0, scale: 0.9 })
      expect(staggerChildScale.visible).toMatchObject({
        opacity: 1,
        scale: 1,
      })
    })

    it('staggerChildSlide fades and slides from left', () => {
      expect(staggerChildSlide.hidden).toEqual({ opacity: 0, x: -20 })
      expect(staggerChildSlide.visible).toMatchObject({
        opacity: 1,
        x: 0,
      })
    })
  })

  describe('Hover Effects', () => {
    it('hoverScale scales to 1.02', () => {
      expect(hoverScale.scale).toBe(1.02)
      expect(hoverScale.transition).toBeDefined()
    })

    it('hoverScaleLarge scales to 1.05', () => {
      expect(hoverScaleLarge.scale).toBe(1.05)
    })

    it('hoverLift moves up and adds shadow', () => {
      expect(hoverLift.y).toBe(-4)
      expect(hoverLift.boxShadow).toBeDefined()
    })

    it('hoverGlow adds glow effect', () => {
      expect(hoverGlow.boxShadow).toContain('rgba')
    })
  })

  describe('Tap Effects', () => {
    it('tapScale scales down to 0.98', () => {
      expect(tapScale.scale).toBe(0.98)
    })

    it('tapScaleSmall scales down to 0.95', () => {
      expect(tapScaleSmall.scale).toBe(0.95)
    })
  })

  describe('Loading Animations', () => {
    it('pulseAnimation has infinite repeat', () => {
      expect(pulseAnimation.animate).toBeDefined()
      expect(pulseAnimation.transition).toMatchObject({
        repeat: Infinity,
      })
    })

    it('shimmerAnimation animates background position', () => {
      expect(shimmerAnimation.animate).toHaveProperty('backgroundPosition')
      expect(shimmerAnimation.transition).toMatchObject({
        repeat: Infinity,
        ease: 'linear',
      })
    })

    it('spinAnimation rotates 360 degrees infinitely', () => {
      expect(spinAnimation.animate).toEqual({ rotate: 360 })
      expect(spinAnimation.transition).toMatchObject({
        repeat: Infinity,
        ease: 'linear',
      })
    })

    it('bounceAnimation moves up and down', () => {
      expect(bounceAnimation.animate).toHaveProperty('y')
      expect(bounceAnimation.transition).toMatchObject({
        repeat: Infinity,
      })
    })
  })

  describe('Page Transitions', () => {
    it('pageTransition slides horizontally', () => {
      expect(pageTransition.initial).toEqual({ opacity: 0, x: 20 })
      expect(pageTransition.animate).toEqual({ opacity: 1, x: 0 })
      expect(pageTransition.exit).toEqual({ opacity: 0, x: -20 })
    })

    it('pageTransitionFade only fades', () => {
      expect(pageTransitionFade.initial).toEqual({ opacity: 0 })
      expect(pageTransitionFade.animate).toEqual({ opacity: 1 })
      expect(pageTransitionFade.exit).toEqual({ opacity: 0 })
    })
  })

  describe('Modal Animations', () => {
    it('modalBackdrop fades in/out', () => {
      expect(modalBackdrop.initial).toEqual({ opacity: 0 })
      expect(modalBackdrop.animate).toEqual({ opacity: 1 })
      expect(modalBackdrop.exit).toEqual({ opacity: 0 })
    })

    it('modalContent scales and slides', () => {
      expect(modalContent.initial).toEqual({ opacity: 0, scale: 0.9, y: 20 })
      expect(modalContent.animate).toMatchObject({
        opacity: 1,
        scale: 1,
        y: 0,
      })
    })

    it('modalSlideUp slides from bottom', () => {
      expect(modalSlideUp.initial).toEqual({ opacity: 0, y: '100%' })
      expect(modalSlideUp.animate).toMatchObject({
        opacity: 1,
        y: 0,
      })
    })
  })

  describe('Notification Animations', () => {
    it('notificationSlide slides from right', () => {
      expect(notificationSlide.initial).toEqual({ opacity: 0, x: 100, scale: 0.9 })
      expect(notificationSlide.animate).toMatchObject({
        opacity: 1,
        x: 0,
        scale: 1,
      })
    })

    it('toastAnimation slides from top', () => {
      expect(toastAnimation.initial).toEqual({ opacity: 0, y: -20, scale: 0.9 })
      expect(toastAnimation.animate).toMatchObject({
        opacity: 1,
        y: 0,
        scale: 1,
      })
    })
  })

  describe('Skeleton Loading', () => {
    it('skeletonPulse pulses opacity', () => {
      expect(skeletonPulse.animate).toHaveProperty('opacity')
      expect(skeletonPulse.transition).toMatchObject({
        repeat: Infinity,
      })
    })
  })

  describe('Success/Celebration Animations', () => {
    it('successCheckmark animates path length', () => {
      expect(successCheckmark.initial).toEqual({ pathLength: 0, opacity: 0 })
      expect(successCheckmark.animate).toMatchObject({
        pathLength: 1,
        opacity: 1,
      })
    })

    it('confettiPop scales and rotates', () => {
      expect(confettiPop.initial).toEqual({ scale: 0, rotate: 0 })
      expect(confettiPop.animate).toMatchObject({
        scale: expect.any(Array),
        rotate: expect.any(Array),
      })
    })
  })
})

describe('Utility Functions', () => {
  describe('getStaggerDelay', () => {
    it('returns correct delay for index 0', () => {
      expect(getStaggerDelay(0)).toBe(0)
    })

    it('returns correct delay for index 1 with default base', () => {
      expect(getStaggerDelay(1)).toBe(0.05)
    })

    it('returns correct delay for index 5 with default base', () => {
      expect(getStaggerDelay(5)).toBe(0.25)
    })

    it('uses custom base delay', () => {
      expect(getStaggerDelay(2, 0.1)).toBe(0.2)
    })

    it('handles large indices', () => {
      expect(getStaggerDelay(100, 0.01)).toBe(1)
    })
  })

  describe('getSpringConfig', () => {
    it('returns gentle config by default', () => {
      const config = getSpringConfig()
      expect(config).toEqual({
        type: 'spring',
        damping: 25,
        stiffness: 200,
      })
    })

    it('returns gentle config when specified', () => {
      const config = getSpringConfig('gentle')
      expect(config).toEqual({
        type: 'spring',
        damping: 25,
        stiffness: 200,
      })
    })

    it('returns bouncy config', () => {
      const config = getSpringConfig('bouncy')
      expect(config).toEqual({
        type: 'spring',
        damping: 15,
        stiffness: 300,
      })
    })

    it('returns stiff config', () => {
      const config = getSpringConfig('stiff')
      expect(config).toEqual({
        type: 'spring',
        damping: 30,
        stiffness: 400,
      })
    })
  })

  describe('triggerHaptic', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('calls navigator.vibrate with light pattern by default', () => {
      const mockVibrate = vi.fn()
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        writable: true,
        configurable: true,
      })

      triggerHaptic()

      expect(mockVibrate).toHaveBeenCalledWith(10)
    })

    it('calls navigator.vibrate with light pattern', () => {
      const mockVibrate = vi.fn()
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        writable: true,
        configurable: true,
      })

      triggerHaptic('light')

      expect(mockVibrate).toHaveBeenCalledWith(10)
    })

    it('calls navigator.vibrate with medium pattern', () => {
      const mockVibrate = vi.fn()
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        writable: true,
        configurable: true,
      })

      triggerHaptic('medium')

      expect(mockVibrate).toHaveBeenCalledWith(25)
    })

    it('calls navigator.vibrate with heavy pattern', () => {
      const mockVibrate = vi.fn()
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        writable: true,
        configurable: true,
      })

      triggerHaptic('heavy')

      expect(mockVibrate).toHaveBeenCalledWith(50)
    })

    it('handles missing vibrate gracefully', () => {
      // When vibrate exists but returns false (e.g., denied by user)
      const mockVibrate = vi.fn().mockReturnValue(false)
      Object.defineProperty(navigator, 'vibrate', {
        value: mockVibrate,
        writable: true,
        configurable: true,
      })

      // Should not throw even if vibrate fails
      expect(() => triggerHaptic()).not.toThrow()
      expect(mockVibrate).toHaveBeenCalled()
    })
  })
})
