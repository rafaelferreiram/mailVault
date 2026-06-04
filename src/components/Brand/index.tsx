// MailVault brand components.
//
// Inlined SVGs (rather than `<img src>` or `?react` imports) so they:
//   1. Inherit `currentColor` for theme-aware tinting in one place.
//   2. Render synchronously — no flash of missing logo on first paint.
//   3. Don't need an extra Vite plugin (`@svgr/rollup` is *not* a dependency).
//
// The geometry is locked to the BRAND_GUIDE: 4 horizontal bars (decreasing
// width) + a vertical bar anchored to the right. Do not rewrite proportions
// here — see resources/medias/BRAND_GUIDE.md.

import type { SVGProps } from 'react';
import clsx from 'clsx';

export interface BrandProps extends SVGProps<SVGSVGElement> {
  /** Override the title for accessibility. Defaults to "MailVault". */
  title?: string;
}

/**
 * Tiny variant of the mark — 3 horizontal bars + 1 vertical bar, optimized
 * for ≤16px. Use this anywhere the regular mark would alias to a smudge
 * (small status pills, dense tab rows, the OAuth flow strip).
 */
export function BrandMarkCompact({
  title = 'MailVault',
  className,
  ...rest
}: BrandProps) {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx('shrink-0', className)}
      fill="currentColor"
      {...rest}
    >
      <title>{title}</title>
      <rect x="0" y="2" width="24" height="4" />
      <rect x="4" y="10" width="20" height="4" />
      <rect x="8" y="18" width="16" height="4" />
      <rect x="12" y="26" width="12" height="4" />
      <rect x="28" y="0" width="4" height="32" />
    </svg>
  );
}

/** The icon mark only (4 + 1 bars). Inherits `currentColor`. */
export function BrandMark({ title = 'MailVault', className, ...rest }: BrandProps) {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 120 100"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx('shrink-0', className)}
      fill="currentColor"
      {...rest}
    >
      <title>{title}</title>
      <rect x="0" y="8" width="88" height="12" />
      <rect x="12" y="30" width="76" height="12" />
      <rect x="24" y="52" width="64" height="12" />
      <rect x="36" y="74" width="52" height="12" />
      <rect x="104" y="0" width="10" height="100" />
    </svg>
  );
}

/**
 * The "mailvault" wordmark — DM Sans, light/bold split. Sits next to the
 * mark in horizontal lockups but can also stand alone in a TopBar.
 */
export function BrandWordmark({
  title = 'mailvault',
  className,
  ...rest
}: BrandProps) {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 384 64"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx('shrink-0', className)}
      {...rest}
    >
      <title>{title}</title>
      <text
        x="0"
        y="48"
        fontFamily="'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
        fontSize="52"
        letterSpacing="-1"
        fill="currentColor"
      >
        <tspan fontWeight={300}>mail</tspan>
        <tspan fontWeight={700}>vault</tspan>
      </text>
    </svg>
  );
}

/**
 * Horizontal lockup: mark + wordmark, on a transparent background.
 * Theme it with `text-fg`, `text-white`, etc. — both glyphs inherit
 * `currentColor`.
 */
export function BrandLockupHorizontal({
  title = 'MailVault',
  className,
  ...rest
}: BrandProps) {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 520 100"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx('shrink-0', className)}
      fill="currentColor"
      {...rest}
    >
      <title>{title}</title>
      {/* Mark */}
      <rect x="0" y="8" width="88" height="12" />
      <rect x="12" y="30" width="76" height="12" />
      <rect x="24" y="52" width="64" height="12" />
      <rect x="36" y="74" width="52" height="12" />
      <rect x="104" y="0" width="10" height="100" />
      {/* Wordmark */}
      <text
        x="136"
        y="72"
        fontFamily="'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
        fontSize="52"
        letterSpacing="-1"
        fill="currentColor"
      >
        <tspan fontWeight={300}>mail</tspan>
        <tspan fontWeight={700}>vault</tspan>
      </text>
    </svg>
  );
}

/**
 * Stacked lockup: mark above wordmark, centered. Used on Welcome / About
 * screens where the lockup needs to read as a "logo plate", not just a
 * header element.
 */
export function BrandLockupStacked({
  title = 'MailVault',
  className,
  ...rest
}: BrandProps) {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 300 200"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx('shrink-0', className)}
      fill="currentColor"
      {...rest}
    >
      <title>{title}</title>
      {/* Mark, centered (90,8) — see resources/medias/BRAND_GUIDE.md */}
      <g transform="translate(90, 8)">
        <rect x="0" y="0" width="88" height="12" />
        <rect x="12" y="22" width="76" height="12" />
        <rect x="24" y="44" width="64" height="12" />
        <rect x="36" y="66" width="52" height="12" />
        <rect x="104" y="-8" width="10" height="92" />
      </g>
      {/* Wordmark, centered */}
      <text
        x="150"
        y="165"
        textAnchor="middle"
        fontFamily="'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
        fontSize="44"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        <tspan fontWeight={300}>mail</tspan>
        <tspan fontWeight={700}>vault</tspan>
      </text>
    </svg>
  );
}
