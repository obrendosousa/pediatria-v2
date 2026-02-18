'use client';

import { useEffect, useRef, useState } from 'react';

type InfoHelpButtonProps = {
  title: string;
  description: string;
};

export default function InfoHelpButton({ title, description }: InfoHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 text-[10px] font-black text-slate-400 transition-all hover:scale-105 hover:border-slate-300 hover:bg-white hover:text-slate-600 dark:border-gray-700 dark:bg-[#111b21]/80 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-200 sm:h-6 sm:w-6 sm:text-xs"
        aria-label={`Explicar ${title}`}
      >
        ?
      </button>
      {open ? (
        <div className="absolute right-0 top-7 z-20 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm dark:border-gray-700 dark:bg-[#111b21]/95">
          <p className="text-xs font-bold text-slate-800 dark:text-gray-100">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-gray-300">{description}</p>
        </div>
      ) : null}
    </div>
  );
}
