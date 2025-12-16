/**
 * Shared mock setup for test files
 * 
 * Import and use these typed mock factories in test files to avoid `any` types.
 * 
 * Usage:
 * ```ts
 * import { createFramerMotionMock, createHelmetMock } from '@/test/mockSetup';
 * 
 * vi.mock('framer-motion', () => createFramerMotionMock());
 * vi.mock('react-helmet-async', () => createHelmetMock());
 * ```
 */
import { ReactNode, HTMLAttributes, ButtonHTMLAttributes, FormHTMLAttributes } from 'react';

// ============================================================================
// Framer Motion Mock Types
// ============================================================================

interface MotionDivProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  whileInView?: unknown;
  variants?: unknown;
  layout?: boolean | string;
  layoutId?: string;
}

interface MotionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
}

interface MotionFormProps extends FormHTMLAttributes<HTMLFormElement> {
  children?: ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
}

interface MotionHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  children?: ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
}

interface MotionParagraphProps extends HTMLAttributes<HTMLParagraphElement> {
  children?: ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
}

interface MotionSpanProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
}

interface AnimatePresenceProps {
  children?: ReactNode;
  mode?: 'sync' | 'wait' | 'popLayout';
  initial?: boolean;
  onExitComplete?: () => void;
}

interface HelmetProps {
  children?: ReactNode;
}

interface HelmetProviderProps {
  children?: ReactNode;
}

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Creates a properly typed mock for framer-motion
 */
export function createFramerMotionMock() {
  return {
    motion: {
      div: ({ children, ...props }: MotionDivProps) => <div {...props}>{children}</div>,
      button: ({ children, ...props }: MotionButtonProps) => <button {...props}>{children}</button>,
      form: ({ children, ...props }: MotionFormProps) => <form {...props}>{children}</form>,
      h1: ({ children, ...props }: MotionHeadingProps) => <h1 {...props}>{children}</h1>,
      h2: ({ children, ...props }: MotionHeadingProps) => <h2 {...props}>{children}</h2>,
      h3: ({ children, ...props }: MotionHeadingProps) => <h3 {...props}>{children}</h3>,
      p: ({ children, ...props }: MotionParagraphProps) => <p {...props}>{children}</p>,
      span: ({ children, ...props }: MotionSpanProps) => <span {...props}>{children}</span>,
      section: ({ children, ...props }: MotionDivProps) => <section {...props}>{children}</section>,
      article: ({ children, ...props }: MotionDivProps) => <article {...props}>{children}</article>,
      nav: ({ children, ...props }: MotionDivProps) => <nav {...props}>{children}</nav>,
      header: ({ children, ...props }: MotionDivProps) => <header {...props}>{children}</header>,
      footer: ({ children, ...props }: MotionDivProps) => <footer {...props}>{children}</footer>,
      main: ({ children, ...props }: MotionDivProps) => <main {...props}>{children}</main>,
      aside: ({ children, ...props }: MotionDivProps) => <aside {...props}>{children}</aside>,
      ul: ({ children, ...props }: MotionDivProps) => <ul {...(props as React.HTMLAttributes<HTMLUListElement>)}>{children}</ul>,
      li: ({ children, ...props }: MotionDivProps) => <li {...(props as React.LiHTMLAttributes<HTMLLIElement>)}>{children}</li>,
      a: ({ children, ...props }: MotionDivProps) => <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{children}</a>,
      img: (props: MotionDivProps) => <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />,
    },
    AnimatePresence: ({ children }: AnimatePresenceProps) => <>{children}</>,
    useAnimation: () => ({
      start: () => Promise.resolve(),
      stop: () => {},
      set: () => {},
    }),
    useMotionValue: (initial: number) => ({
      get: () => initial,
      set: () => {},
      onChange: () => () => {},
    }),
    useTransform: () => ({
      get: () => 0,
      set: () => {},
    }),
    useSpring: () => ({
      get: () => 0,
      set: () => {},
    }),
    useInView: () => true,
    useScroll: () => ({
      scrollY: { get: () => 0 },
      scrollX: { get: () => 0 },
      scrollYProgress: { get: () => 0 },
      scrollXProgress: { get: () => 0 },
    }),
  };
}

/**
 * Creates a properly typed mock for react-helmet-async
 */
export function createHelmetMock() {
  return {
    Helmet: ({ children }: HelmetProps) => <>{children}</>,
    HelmetProvider: ({ children }: HelmetProviderProps) => <>{children}</>,
  };
}
