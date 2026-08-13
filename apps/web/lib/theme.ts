// Runtime color values for inline `style`/component-prop colors (e.g. dynamic
// accent colors in a mapped array, or SVG/canvas color props) where a static
// Tailwind class can't be generated at build time. Mirrors the CSS vars
// defined in app/globals.css :root.
export const CELO_YELLOW = "rgb(var(--color-celo-yellow-rgb))";
export const CELO_DARK = "rgb(var(--color-celo-dark-rgb))";
export const MINIPAY_TEAL = "rgb(var(--color-minipay-teal-rgb))";

export const celoYellowAlpha = (alpha: number) => `rgb(var(--color-celo-yellow-rgb) / ${alpha})`;
export const minipayTealAlpha = (alpha: number) => `rgb(var(--color-minipay-teal-rgb) / ${alpha})`;
