'use client';

import { useEffect, useRef } from 'react';

// Global in-memory cache — persists across component remounts
const cache = new Map<string, string>();
const loading = new Set<string>();

function preload(url: string) {
  if (!url || cache.has(url) || loading.has(url)) return;
  loading.add(url);

  const img = new Image();
  img.onload = () => {
    cache.set(url, url);
    loading.delete(url);
  };
  img.onerror = () => {
    loading.delete(url);
  };
  img.src = url;
}

/** Pre-load a list of image URLs into browser memory cache */
export function useImageCache(urls: (string | undefined | null)[]) {
  const prevRef = useRef<string>('');

  useEffect(() => {
    const valid = urls.filter(Boolean) as string[];
    const key = valid.join(',');
    if (key === prevRef.current) return;
    prevRef.current = key;

    for (const url of valid) {
      preload(url);
    }
  }, [urls]);
}

/** Check if an image is already cached */
export function isImageCached(url: string): boolean {
  return cache.has(url);
}

/** Pre-load a single image */
export function preloadImage(url: string) {
  preload(url);
}
