/**
 * Animation Utilities - Micro-interactions Library
 * 
 * Shared animation variants and utilities for consistent UX across the app.
 * Use these with Framer Motion components.
 */

// Animation variant type - simplified for flexibility
type AnimationVariant = {
  initial?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  exit?: Record<string, unknown>;
  transition?: Record<string, unknown>;
  hidden?: Record<string, unknown>;
  visible?: Record<string, unknown>;
};

// ============================================
// FADE ANIMATIONS
// ============================================
export const fadeIn: AnimationVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp: AnimationVariant = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const fadeInDown: AnimationVariant = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

export const fadeInLeft: AnimationVariant = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const fadeInRight: AnimationVariant = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// ============================================
// SCALE ANIMATIONS
// ============================================
export const scaleIn: AnimationVariant = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export const scaleInBounce: AnimationVariant = {
  initial: { opacity: 0, scale: 0.5 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { type: "spring", damping: 15, stiffness: 300 }
  },
  exit: { opacity: 0, scale: 0.5 },
};

export const popIn: AnimationVariant = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { type: "spring", damping: 20 }
  },
  exit: { opacity: 0, scale: 0.8 },
};

// ============================================
// SLIDE ANIMATIONS
// ============================================
export const slideInFromBottom: AnimationVariant = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
  transition: { type: "spring", damping: 25, stiffness: 200 }
};

export const slideInFromTop: AnimationVariant = {
  initial: { y: "-100%" },
  animate: { y: 0 },
  exit: { y: "-100%" },
  transition: { type: "spring", damping: 25, stiffness: 200 }
};

export const slideInFromLeft: AnimationVariant = {
  initial: { x: "-100%" },
  animate: { x: 0 },
  exit: { x: "-100%" },
  transition: { type: "spring", damping: 25, stiffness: 200 }
};

export const slideInFromRight: AnimationVariant = {
  initial: { x: "100%" },
  animate: { x: 0 },
  exit: { x: "100%" },
  transition: { type: "spring", damping: 25, stiffness: 200 }
};

// ============================================
// STAGGER CONTAINER VARIANTS
// ============================================
export const staggerContainer: AnimationVariant = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: AnimationVariant = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const staggerContainerSlow: AnimationVariant = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

// ============================================
// STAGGER CHILD VARIANTS
// ============================================
export const staggerChild: AnimationVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
  },
};

export const staggerChildScale: AnimationVariant = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.3 }
  },
};

export const staggerChildSlide: AnimationVariant = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3 }
  },
};

// ============================================
// HOVER EFFECTS
// ============================================
export const hoverScale = {
  scale: 1.02,
  transition: { duration: 0.2 }
};

export const hoverScaleLarge = {
  scale: 1.05,
  transition: { duration: 0.2 }
};

export const hoverLift = {
  y: -4,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  transition: { duration: 0.2 }
};

export const hoverGlow = {
  boxShadow: "0 0 30px rgba(216, 67, 21, 0.3)",
  transition: { duration: 0.3 }
};

// ============================================
// TAP EFFECTS
// ============================================
export const tapScale = {
  scale: 0.98
};

export const tapScaleSmall = {
  scale: 0.95
};

// ============================================
// LOADING ANIMATIONS
// ============================================
export const pulseAnimation = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut"
  }
};

export const shimmerAnimation = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "linear"
  }
};

export const spinAnimation = {
  animate: { rotate: 360 },
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: "linear"
  }
};

export const bounceAnimation = {
  animate: {
    y: [0, -10, 0],
  },
  transition: {
    duration: 0.6,
    repeat: Infinity,
    ease: "easeInOut"
  }
};

// ============================================
// PAGE TRANSITIONS
// ============================================
export const pageTransition: AnimationVariant = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.3 }
};

export const pageTransitionFade: AnimationVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 }
};

// ============================================
// MODAL ANIMATIONS
// ============================================
export const modalBackdrop: AnimationVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContent: AnimationVariant = {
  initial: { opacity: 0, scale: 0.9, y: 20 },
  animate: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: "spring", damping: 25, stiffness: 300 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.9, 
    y: 20,
    transition: { duration: 0.2 }
  },
};

export const modalSlideUp: AnimationVariant = {
  initial: { opacity: 0, y: "100%" },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", damping: 30, stiffness: 300 }
  },
  exit: { 
    opacity: 0, 
    y: "100%",
    transition: { duration: 0.2 }
  },
};

// ============================================
// NOTIFICATION ANIMATIONS
// ============================================
export const notificationSlide: AnimationVariant = {
  initial: { opacity: 0, x: 100, scale: 0.9 },
  animate: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: { type: "spring", damping: 20 }
  },
  exit: { 
    opacity: 0, 
    x: 100, 
    scale: 0.9,
    transition: { duration: 0.2 }
  },
};

export const toastAnimation: AnimationVariant = {
  initial: { opacity: 0, y: -20, scale: 0.9 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", damping: 20 }
  },
  exit: { 
    opacity: 0, 
    y: -20, 
    scale: 0.9,
    transition: { duration: 0.15 }
  },
};

// ============================================
// SKELETON LOADING
// ============================================
export const skeletonPulse = {
  animate: {
    opacity: [0.5, 1, 0.5],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut"
  }
};

// ============================================
// SUCCESS/CELEBRATION
// ============================================
export const successCheckmark: AnimationVariant = {
  initial: { pathLength: 0, opacity: 0 },
  animate: { 
    pathLength: 1, 
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" }
  },
};

export const confettiPop: AnimationVariant = {
  initial: { scale: 0, rotate: 0 },
  animate: { 
    scale: [0, 1.2, 1],
    rotate: [0, 180, 360],
    transition: { duration: 0.6, ease: "easeOut" }
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a stagger delay for list items
 */
export function getStaggerDelay(index: number, baseDelay: number = 0.05): number {
  return index * baseDelay;
}

type SpringPreset = 'gentle' | 'bouncy' | 'stiff';

interface SpringConfig {
  type: "spring";
  damping: number;
  stiffness: number;
}

/**
 * Create spring transition config
 */
export function getSpringConfig(preset: SpringPreset = 'gentle'): SpringConfig {
  const configs: Record<SpringPreset, SpringConfig> = {
    gentle: { type: "spring", damping: 25, stiffness: 200 },
    bouncy: { type: "spring", damping: 15, stiffness: 300 },
    stiff: { type: "spring", damping: 30, stiffness: 400 },
  };
  return configs[preset] || configs.gentle;
}

type HapticType = 'light' | 'medium' | 'heavy';

/**
 * Trigger haptic feedback (on supported devices)
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  if ('vibrate' in navigator) {
    const patterns: Record<HapticType, number> = {
      light: 10,
      medium: 25,
      heavy: 50,
    };
    navigator.vibrate(patterns[type] || 10);
  }
}

export default {
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
};
