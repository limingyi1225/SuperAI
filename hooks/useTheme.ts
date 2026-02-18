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

export function useTheme(): UseThemeReturn {
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [, setTheme] = useState<'dark' | 'light'>('dark');

  // Hydrate from localStorage on mount
  useEffect(() => {
    const savedThemeMode = localStorage.getItem('themeMode');
    const legacyTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;

    const initialThemeMode: ThemeMode = (
      savedThemeMode === 'light' || savedThemeMode === 'dark' || savedThemeMode === 'auto'
        ? savedThemeMode
        : (legacyTheme ?? 'auto')
    );

    const initialTheme = initialThemeMode === 'auto' ? resolveTimeBasedTheme() : initialThemeMode;
    setThemeMode(initialThemeMode);
    setTheme(initialTheme);
    applyThemeToDocument(initialTheme);
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
