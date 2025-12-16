import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHaptics } from './use-haptics'

/**
 * Note: The useHaptics hook checks for vibration support at module load time.
 * In jsdom test environment, navigator.vibrate doesn't exist, so vibrate()
 * will always return false. These tests focus on the hook's API shape and
 * audio functionality. Vibration behavior is tested in E2E tests on real devices.
 */

// Mock AudioContext for audio tests
const mockOscillator = {
  connect: vi.fn(),
  type: 'sine' as OscillatorType,
  frequency: { setValueAtTime: vi.fn() },
  start: vi.fn(),
  stop: vi.fn(),
}

const mockGainNode = {
  connect: vi.fn(),
  gain: {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
}

const mockAudioContext = {
  createOscillator: vi.fn(() => mockOscillator),
  createGain: vi.fn(() => mockGainNode),
  destination: {},
  currentTime: 0,
}

// Create a proper constructor mock for vitest 4.x
class MockAudioContext {
  createOscillator = mockAudioContext.createOscillator;
  createGain = mockAudioContext.createGain;
  destination = mockAudioContext.destination;
  currentTime = mockAudioContext.currentTime;
}

vi.stubGlobal('AudioContext', MockAudioContext)

describe('useHaptics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all expected feedback methods', () => {
    const { result } = renderHook(() => useHaptics())
    
    expect(result.current.light).toBeDefined()
    expect(result.current.medium).toBeDefined()
    expect(result.current.heavy).toBeDefined()
    expect(result.current.success).toBeDefined()
    expect(result.current.error).toBeDefined()
    expect(result.current.warning).toBeDefined()
    expect(result.current.notification).toBeDefined()
    expect(result.current.selection).toBeDefined()
    expect(result.current.impact).toBeDefined()
    expect(result.current.vibrate).toBeDefined()
    expect(result.current.playSound).toBeDefined()
  })

  it('reports canVibrate capability', () => {
    const { result } = renderHook(() => useHaptics())
    expect(typeof result.current.canVibrate).toBe('boolean')
  })

  it('reports hasAudio capability', () => {
    const { result } = renderHook(() => useHaptics())
    expect(typeof result.current.hasAudio).toBe('boolean')
  })

  describe('vibrate function', () => {
    // Note: In jsdom, navigator.vibrate doesn't exist, so canVibrate is false
    // and vibrate() returns false without calling navigator.vibrate.
    // These tests verify the function doesn't throw and returns the expected value.
    
    it('returns false when vibration is not supported', () => {
      const { result } = renderHook(() => useHaptics())
      const returned = result.current.vibrate()
      
      // In jsdom, vibration is not supported
      expect(returned).toBe(false)
    })

    it('accepts pattern parameter without throwing', () => {
      const { result } = renderHook(() => useHaptics())
      
      expect(() => result.current.vibrate('light')).not.toThrow()
      expect(() => result.current.vibrate('heavy')).not.toThrow()
      expect(() => result.current.vibrate('success')).not.toThrow()
      expect(() => result.current.vibrate('error')).not.toThrow()
      expect(() => result.current.vibrate('unknown')).not.toThrow()
    })
  })

  describe('feedback methods', () => {
    it('light() triggers sound by default', () => {
      const { result } = renderHook(() => useHaptics())
      result.current.light()
      
      expect(mockAudioContext.createOscillator).toHaveBeenCalled()
    })

    it('medium() triggers sound', () => {
      const { result } = renderHook(() => useHaptics())
      result.current.medium()
      
      expect(mockAudioContext.createOscillator).toHaveBeenCalled()
    })

    it('success() does not throw', () => {
      const { result } = renderHook(() => useHaptics())
      expect(() => result.current.success()).not.toThrow()
    })

    it('error() does not throw', () => {
      const { result } = renderHook(() => useHaptics())
      expect(() => result.current.error()).not.toThrow()
    })

    it('respects sound: false option', () => {
      const { result } = renderHook(() => useHaptics())
      result.current.light({ sound: false })
      
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled()
    })

    it('respects haptic: false option and still plays sound', () => {
      const { result } = renderHook(() => useHaptics())
      result.current.light({ haptic: false })
      
      expect(mockAudioContext.createOscillator).toHaveBeenCalled()
    })

    it('respects volume option', () => {
      const { result } = renderHook(() => useHaptics())
      result.current.light({ volume: 0.5 })
      
      expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.5, 0)
    })
  })

  describe('playSound function', () => {
    it('creates oscillator with correct settings for success sound', () => {
      const { result } = renderHook(() => useHaptics())
      result.current.playSound('success')
      
      expect(mockAudioContext.createOscillator).toHaveBeenCalled()
      expect(mockAudioContext.createGain).toHaveBeenCalled()
      expect(mockOscillator.connect).toHaveBeenCalledWith(mockGainNode)
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockAudioContext.destination)
    })

    it('does nothing for unknown sound type', () => {
      const { result } = renderHook(() => useHaptics())
      result.current.playSound('unknown')
      
      expect(mockOscillator.start).not.toHaveBeenCalled()
    })
  })

  // Note: Tests for 'when vibration is not supported' are skipped because
  // canVibrate is checked at module load time, and we need the mock to be
  // set up before the module loads for other tests to work.
})
