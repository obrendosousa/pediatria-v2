/**
 * Animation System — Framer Motion variants & utilities
 * Reusable animation presets for the WhatsApp chat UI
 */

import type { Variants, Transition } from 'framer-motion';

// ─── Easing curves ───────────────────────────────────────
export const easings = {
  smooth: [0.4, 0, 0.2, 1] as const,
  bounce: [0.34, 1.56, 0.64, 1] as const,
  snappy: [0.22, 1, 0.36, 1] as const,
  elastic: [0.68, -0.55, 0.27, 1.55] as const,
  decel: [0, 0, 0.2, 1] as const,
};

// ─── Standard transitions ────────────────────────────────
export const transitions = {
  fast: { duration: 0.15, ease: easings.smooth } as Transition,
  normal: { duration: 0.3, ease: easings.snappy } as Transition,
  slow: { duration: 0.5, ease: easings.snappy } as Transition,
  spring: { type: 'spring', stiffness: 400, damping: 25 } as Transition,
  springBouncy: { type: 'spring', stiffness: 500, damping: 15 } as Transition,
  springGentle: { type: 'spring', stiffness: 200, damping: 20 } as Transition,
};

// ─── Fade variants ───────────────────────────────────────
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: easings.smooth } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easings.snappy } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easings.snappy } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.2 } },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: easings.snappy } },
  exit: { opacity: 0, x: -16, transition: { duration: 0.2 } },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: easings.snappy } },
  exit: { opacity: 0, x: 16, transition: { duration: 0.2 } },
};

// ─── Scale variants ──────────────────────────────────────
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: easings.bounce } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 500, damping: 15 },
  },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
};

export const bounceIn: Variants = {
  hidden: { opacity: 0, scale: 0.3, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 12 },
  },
};

// ─── Slide variants ──────────────────────────────────────
export const slideInFromBottom: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easings.snappy } },
  exit: { opacity: 0, y: 20, transition: { duration: 0.25 } },
};

export const slideInFromTop: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easings.snappy } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

export const slideInFromRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: easings.snappy } },
  exit: { opacity: 0, x: 40, transition: { duration: 0.25 } },
};

// ─── Stagger container ───────────────────────────────────
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// ─── Stagger item ────────────────────────────────────────
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: easings.snappy },
  },
};

export const staggerItemScale: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: easings.snappy },
  },
};

// ─── Modal / overlay ─────────────────────────────────────
export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 25, delay: 0.05 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15, ease: easings.smooth },
  },
};

// ─── Button variants ─────────────────────────────────────
export const sendButtonVariants: Variants = {
  hidden: { opacity: 0, scale: 0, rotate: -90 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: 'spring', stiffness: 500, damping: 15 },
  },
  exit: {
    opacity: 0,
    scale: 0,
    rotate: 90,
    transition: { duration: 0.15 },
  },
};

// ─── Scroll to bottom button ─────────────────────────────
export const scrollButtonVariants: Variants = {
  hidden: { opacity: 0, scale: 0.6, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  },
  exit: {
    opacity: 0,
    scale: 0.6,
    y: 20,
    transition: { duration: 0.2 },
  },
};

// ─── Pulse animation for status indicators ───────────────
export const pulseVariants: Variants = {
  idle: { scale: 1, opacity: 1 },
  pulse: {
    scale: [1, 1.2, 1],
    opacity: [1, 0.7, 1],
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ─── Shimmer for loading states ──────────────────────────
export const shimmer: Variants = {
  hidden: { opacity: 0.4 },
  visible: {
    opacity: [0.4, 0.7, 0.4],
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ─── Recording pulse ─────────────────────────────────────
export const recordingPulse: Variants = {
  idle: { scale: 1 },
  recording: {
    scale: [1, 1.15, 1],
    transition: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ─── Typing indicator ────────────────────────────────────
export const typingDot = (delay: number): Variants => ({
  idle: { y: 0, opacity: 0.4 },
  animate: {
    y: [0, -6, 0],
    opacity: [0.4, 1, 0.4],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      delay,
      ease: 'easeInOut',
    },
  },
});
