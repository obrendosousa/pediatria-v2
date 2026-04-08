'use client';

import { motion, AnimatePresence, type Variants } from 'framer-motion';
import NumberFlow from '@number-flow/react';
import { forwardRef, type ReactNode, type ComponentProps } from 'react';

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── FadeIn ──────────────────────────────────────────────
export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.4,
  y = 8,
  ...props
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  y?: number;
} & Omit<ComponentProps<typeof motion.div>, 'initial' | 'animate' | 'transition'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ─── Stagger Container + Item ────────────────────────────
const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function StaggerContainer({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={{
        ...staggerContainerVariants,
        show: {
          ...staggerContainerVariants.show,
          transition: {
            staggerChildren: 0.05,
            delayChildren: delay,
          },
        },
      }}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItemVariants} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Animated Number (NumberFlow wrapper) ────────────────
export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  className,
  format,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  format?: Parameters<typeof NumberFlow>[0]['format'];
}) {
  return (
    <span className={cn('inline-flex items-baseline tabular-nums', className)}>
      {prefix && <span>{prefix}</span>}
      <NumberFlow
        value={value}
        format={format}
        transformTiming={{ duration: 700, easing: 'ease-out' }}
        spinTiming={{ duration: 700, easing: 'ease-out' }}
      />
      {suffix && <span className="ml-0.5">{suffix}</span>}
    </span>
  );
}

// ─── PulseGlow ───────────────────────────────────────────
export function PulseGlow({
  color = 'bg-rose-500',
  size = 'h-5 w-5',
  className,
  children,
}: {
  color?: string;
  size?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span className={cn('relative flex items-center justify-center', className)}>
      <motion.span
        className={cn('absolute inset-0 rounded-full opacity-40', color)}
        animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className={cn('relative flex items-center justify-center rounded-full text-white text-[10px] font-bold shadow-sm', size, color)}>
        {children}
      </span>
    </span>
  );
}

// ─── GlassCard ───────────────────────────────────────────
export const GlassCard = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    className?: string;
    hoverLift?: boolean;
  } & Omit<ComponentProps<typeof motion.div>, 'ref'>
>(({ children, className, hoverLift = true, ...props }, ref) => {
  return (
    <motion.div
      ref={ref}
      className={cn(
        'rounded-2xl border border-white/20 bg-white/80 p-4 shadow-sm backdrop-blur-sm',
        'dark:border-white/[0.06] dark:bg-[#08080b]/80',
        className
      )}
      whileHover={
        hoverLift
          ? { y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }
          : undefined
      }
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      {...props}
    >
      {children}
    </motion.div>
  );
});
GlassCard.displayName = 'GlassCard';

// ─── Tab Sliding Indicator ───────────────────────────────
export function TabIndicator({ className }: { className?: string }) {
  return (
    <motion.div
      layoutId="crm-tab-indicator"
      className={cn(
        'absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-[#1c1c21]',
        className
      )}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
    />
  );
}

// ─── Content Transition Wrapper ──────────────────────────
export function ContentTransition({
  children,
  activeKey,
  className,
}: {
  children: ReactNode;
  activeKey: string;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={cn('h-full', className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
