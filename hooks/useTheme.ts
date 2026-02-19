'use client';

import { useState, useCallback, useEffect } from 'react';
import { resolveTimeBasedTheme } from '@/lib/hookUtils';

export type ThemeMode = 'dark' | 'light' | 'auto';

export function applyThemeToDocument(theme: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', theme);
}

export interface UseThemeReturn {
  themeMode: ThemeMode;
  handleThemeModeChange: (nextMode: ThemeMode) => void;
}

function resolveInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto';
  const saved = localStorage.getItem('themeMode');
  if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
  const legacy = localStorage.getItem('theme') as 'dark' | 'light' | null;
  return legacy ?? 'auto';
}

export function useTheme(): UseThemeReturn {
  const [themeMode, setThemeMode] = useState<ThemeMode>(resolveInitialThemeMode);
  const [, setTheme] = useState<'dark' | 'light'>(() => {
    const mode = resolveInitialThemeMode();
    return mode === 'auto' ? resolveTimeBasedTheme() : mode;
  });

  // Apply theme to document on mount (cannot run during SSR)
  useEffect(() => {
    const mode = themeMode;
    const theme = mode === 'auto' ? resolveTimeBasedTheme() : mode;
    applyThemeToDocument(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In auto mode, re-evaluate every minute in case local hour crosses threshold
  useEffect(() => {
    if (themeMode !== 'auto') return;

    const intervalId = window.setInterval(() => {
      const nextTheme = resolveTimeBasedTheme();
      setTheme(prev => {
        if (prev === nextTheme) return prev;
        applyThemeToDocument(nextTheme);
        return nextTheme;
      });
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [themeMode]);

  const handleThemeModeChange = useCallback((nextMode: ThemeMode) => {
    setThemeMode(nextMode);
    localStorage.setItem('themeMode', nextMode);

    const nextTheme = nextMode === 'auto' ? resolveTimeBasedTheme() : nextMode;
    setTheme(nextTheme);
    applyThemeToDocument(nextTheme);

    // Keep backward compatibility for previous key.
    if (nextMode === 'auto') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', nextMode);
    }
  }, []);

  return { themeMode, handleThemeModeChange };
}
