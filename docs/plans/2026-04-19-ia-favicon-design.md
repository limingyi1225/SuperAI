# IA Favicon Design

## Goal

Replace the current generic lowercase `i` favicon with a custom `IA` monogram that feels softer, cleaner, and more brand-specific in the browser tab.

## Constraints

- The icon must stay legible at favicon sizes such as `16x16` and `32x32`.
- The visual tone should follow the user's selected `A` concept: powder baby blue tile, deep navy letterforms, soft premium restraint.
- The result must still feel distinct from Anthropic rather than derivative.
- The existing Next.js favicon wiring should remain intact.

## Proposed Direction

Use a rounded-square tile with a powder baby blue gradient and a deep navy `IA` monogram.

- `I` stays on the left with a simple editorial slab feel and a slight diagonal cut so it still feels custom.
- `A` stays on the right with a geometric body and triangular counter that stays legible at favicon sizes.
- The composition is cleaner and more open than the previous warm concept so the icon feels lighter in the tab.
- The tile gets a faint inset stroke and a restrained top-left sheen so it feels polished without relying on heavy effects.

## Why This Direction

- The baby blue palette matches the approved direction and softens the overall brand impression.
- Custom letter construction improves recognizability in the browser tab.
- The navy-on-blue contrast stays strong enough for small-size rendering without feeling harsh.

## Validation

1. Keep `/favicon.svg` as the main linked asset in `app/layout.tsx`.
2. Add a resource-level regression test that checks the app still points at the SVG favicon and that the SVG now contains the new `IA` monogram markers.
3. Regenerate `app/favicon.ico` from the updated SVG so legacy favicon requests do not show the old icon.
4. Run the targeted favicon test and a production build.
