'use client';

import { CSSProperties, HTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import { getDisplacementFilter } from './getDisplacementFilter';
import styles from './LiquidGlass.module.css';

interface LiquidGlassProps extends HTMLAttributes<HTMLDivElement> {
  /** Border radius for displacement map gradient calculation. Default: 100 (circular style) */
  radius?: number;
  /** Blur amount in px. Default: 4 */
  blur?: number;
  /** Depth of displacement distortion. Default: 10 */
  depth?: number;
  /** Chromatic aberration strength. Default: 0 (clean, no color fringing) */
  chromaticAberration?: number;
  /** Displacement strength. Default: 100 */
  strength?: number;
  /** Blur falloff for non-supported browsers. Default: 20 */
  fallbackBlur?: number;
  /** Disable the effect entirely */
  disabled?: boolean;
}

/** Detect if the browser supports SVG filter references in backdrop-filter (Chromium-only) */
function useSvgBackdropFilter(): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSupported(CSS.supports?.('backdrop-filter', 'url("#x")') ?? false);
  }, []);
  return supported;
}

/** Track the current theme (light vs dark) reactively */
function useIsLightTheme(): boolean {
  const [isLight, setIsLight] = useState(false);
  useEffect(() => {
    const check = () =>
      setIsLight(document.documentElement.dataset.theme === 'light');
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  return isLight;
}

export default function LiquidGlass({
  children,
  className,
  style,
  radius = 100,
  blur = 4,
  depth = 10,
  chromaticAberration = 0,
  strength = 100,
  fallbackBlur = 20,
  disabled = false,
  ...rest
}: LiquidGlassProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const supported = useSvgBackdropFilter();
  const isLight = useIsLightTheme();

  // Track element size via ResizeObserver, rounded to nearest 10px
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const boxSize = entry.borderBoxSize?.[0];
      const width = boxSize ? boxSize.inlineSize : entry.contentRect.width;
      const height = boxSize ? boxSize.blockSize : entry.contentRect.height;
      const w = Math.ceil(width / 10) * 10;
      const h = Math.ceil(height / 10) * 10;
      if (w <= 0 || h <= 0) return;
      setDimensions(prev =>
        prev && prev.w === w && prev.h === h ? prev : { w, h }
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // In light mode, scale down chromatic aberration to avoid garish rainbow fringing
  const effectiveCA = isLight
    ? Math.round(chromaticAberration / 3)
    : chromaticAberration;

  // Memoize the SVG filter data URI
  const filterUrl = useMemo(() => {
    if (!dimensions || disabled || !supported) return null;
    return getDisplacementFilter({
      width: dimensions.w,
      height: dimensions.h,
      radius: Math.min(radius, dimensions.w / 2, dimensions.h / 2),
      depth,
      strength,
      chromaticAberration: effectiveCA,
    });
  }, [dimensions, radius, depth, strength, effectiveCA, disabled, supported]);

  // Build the backdrop-filter value
  // Light mode: subtle brightness/saturate + slight contrast for realistic glass refraction
  // Dark mode: original values that look great on dark backgrounds
  const backdropFilter = filterUrl
    ? isLight
      ? `blur(${blur / 2}px) url('${filterUrl}') blur(${blur}px) brightness(1.02) saturate(1.1) contrast(1.03)`
      : `blur(${blur / 2}px) url('${filterUrl}') blur(${blur}px) brightness(1.1) saturate(1.5)`
    : `blur(${fallbackBlur}px)`;

  const mergedStyle: CSSProperties = {
    ...style,
    backdropFilter,
    WebkitBackdropFilter: backdropFilter,
  };

  const mergedClassName = className
    ? `${styles.glass} ${className}`
    : styles.glass;

  return (
    <div ref={ref} className={mergedClassName} style={mergedStyle} {...rest}>
      {children}
    </div>
  );
}
