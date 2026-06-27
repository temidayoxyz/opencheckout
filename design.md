# OpenCheckout design system

This document is the product-wide visual and content contract. The source of
truth for implementation tokens is `src/app/globals.css`.

## Product character

OpenCheckout should feel calm, trustworthy, modern, and direct. Financial
actions must remain unmistakable even when surfaces use translucent glass.

- Use generous space and a strong monochrome hierarchy.
- Use pastel blocks to organize information, not to decorate every surface.
- Keep payment amounts, status, and the primary action visually dominant.
- Prefer plain customer language over protocol or cryptography terminology.
- Never imitate another payment brand in product copy.

## Foundations

### Color

- Primary ink: `#000000`
- Canvas: `#ffffff`
- Soft text: `#4d4d4d`
- Error/accent: `#eb4c8e`
- Success: `#0d9e53`
- Signature blocks: lime, lilac, cream, mint, pink, coral, and navy tokens from
  `globals.css`

Text must meet WCAG AA contrast. Translucent surfaces require an opaque-enough
fallback and a visible boundary.

### Typography

- Interface: Geist/Inter/system sans-serif
- IDs, endpoints, labels, and code: Geist Mono/system monospace
- Use weight and size for hierarchy; avoid very faint body text.

### Shape and depth

- Buttons are pill-shaped.
- Product cards use 24–32px radii.
- Glass is reserved for cards, navigation, and focused panels.
- Shadows should be broad and subtle, never glossy or skeuomorphic.

## Components

### Buttons

- One primary action per decision area.
- Disabled buttons must remain readable and explain their disabled state in
  nearby copy where it is not obvious.
- Every action needs hover, keyboard-focus, pending, success, and error states.

### Forms

- Every input has a programmatic label.
- Errors use `role="alert"` and describe how to recover.
- Financial identifiers are never persisted in browser storage unless required.

### Status

- Do not rely on color alone; always render the status text.
- Humanize machine states (`awaiting_approval` → `awaiting approval`).
- A processing state must warn customers not to submit a second payment.

### Tables

- Tables scroll horizontally below their minimum readable width.
- Empty, loading, error, and populated states are required.

## Accessibility and motion

- Target WCAG 2.2 AA.
- All interactive controls must be keyboard reachable with a visible focus ring.
- Respect `prefers-reduced-motion`.
- Decorative images use empty alt text; brand and functional images use concise
  alt text.
- Minimum touch target: 44×44 CSS pixels where practical.

## Responsive behavior

- Checkout remains single-column and centered.
- Dashboard navigation wraps on small screens without hiding actions.
- No payment amount, wallet address, API key, or table action may be clipped.

## Content rules

- Lead with the outcome: “Complete your payment,” not protocol mechanics.
- Mention Open Payments where it clarifies compatibility or trust.
- Keep cryptographic algorithms in technical documentation, not marketing copy.
- State fee claims precisely: OpenCheckout adds no transaction fee; account
  providers may charge fees or exchange rates.
