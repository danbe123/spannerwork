/**
 * Haptic Feedback & Sound Effects Hook
 * 
 * Provides tactile and audio feedback for mobile interactions.
 * Uses the Vibration API for haptics and Web Audio API for sounds.
 */

// Check for vibration support
const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

// Audio context for sound effects
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (!audioContext && typeof AudioContext !== 'undefined') {
    audioContext = new AudioContext();
  }
  return audioContext;
};

// Vibration patterns (in milliseconds)
const VIBRATION_PATTERNS: Record<string, number[]> = {
  // Light tap - quick single vibration
  light: [10],
  // Medium tap - slightly longer
  medium: [25],
  // Heavy tap - noticeable vibration
  heavy: [50],
  // Success - two quick pulses
  success: [30, 50, 30],
  // Error - three rapid pulses
  error: [50, 30, 50, 30, 50],
  // Warning - long then short
  warning: [100, 50, 30],
  // Selection change
  selection: [15],
  // Impact - strong single
  impact: [80],
  // Notification
  notification: [50, 100, 50],
};

// Sound frequencies and durations
const SOUNDS: Record<string, { frequency: number; duration: number; type: OscillatorType }> = {
  success: { frequency: 880, duration: 0.1, type: 'sine' },
  error: { frequency: 220, duration: 0.15, type: 'square' },
  notification: { frequency: 660, duration: 0.08, type: 'sine' },
  click: { frequency: 1200, duration: 0.03, type: 'sine' },
  pop: { frequency: 400, duration: 0.05, type: 'sine' },
  swoosh: { frequency: 300, duration: 0.1, type: 'triangle' },
};

/**
 * Play a sound effect
 */
function playSound(soundType: string, volume = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const sound = SOUNDS[soundType];
  if (!sound) return;

  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = sound.type;
    oscillator.frequency.setValueAtTime(sound.frequency, ctx.currentTime);

    // Fade out
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + sound.duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + sound.duration);
  } catch {
    // Silently fail - audio might not be allowed
  }
}

/**
 * Trigger haptic feedback
 */
function vibrate(pattern: string = 'medium'): boolean {
  if (!canVibrate) return false;

  const vibrationPattern = VIBRATION_PATTERNS[pattern] || VIBRATION_PATTERNS.medium;
  
  try {
    navigator.vibrate(vibrationPattern);
    return true;
  } catch {
    return false;
  }
}

interface FeedbackOptions {
  sound?: boolean;
  haptic?: boolean;
  volume?: number;
}

/**
 * Combined haptic + sound feedback
 */
function feedback(type: string = 'medium', options: FeedbackOptions = {}): void {
  const { sound = true, haptic = true, volume = 0.3 } = options;

  if (haptic) {
    vibrate(type);
  }

  if (sound) {
    const soundMap: Record<string, string> = {
      success: 'success',
      error: 'error',
      warning: 'error',
      notification: 'notification',
      light: 'click',
      medium: 'pop',
      heavy: 'pop',
      selection: 'click',
      impact: 'swoosh',
    };
    playSound(soundMap[type] || 'click', volume);
  }
}

export interface UseHapticsReturn {
  light: (options?: FeedbackOptions) => void;
  medium: (options?: FeedbackOptions) => void;
  heavy: (options?: FeedbackOptions) => void;
  success: (options?: FeedbackOptions) => void;
  error: (options?: FeedbackOptions) => void;
  warning: (options?: FeedbackOptions) => void;
  notification: (options?: FeedbackOptions) => void;
  selection: (options?: FeedbackOptions) => void;
  impact: (options?: FeedbackOptions) => void;
  vibrate: typeof vibrate;
  playSound: typeof playSound;
  canVibrate: boolean;
  hasAudio: boolean;
}

/**
 * React hook for haptic feedback
 */
export function useHaptics(): UseHapticsReturn {
  return {
    // Basic feedback
    light: (options) => feedback('light', options),
    medium: (options) => feedback('medium', options),
    heavy: (options) => feedback('heavy', options),
    
    // Semantic feedback
    success: (options) => feedback('success', options),
    error: (options) => feedback('error', options),
    warning: (options) => feedback('warning', options),
    notification: (options) => feedback('notification', options),
    
    // Interaction feedback
    selection: (options) => feedback('selection', options),
    impact: (options) => feedback('impact', options),
    
    // Raw access
    vibrate,
    playSound,
    
    // Capabilities
    canVibrate,
    hasAudio: typeof AudioContext !== 'undefined',
  };
}

export default useHaptics;
