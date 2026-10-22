# Portal themes

The four themes share application data, permissions, routes and component APIs.
They select typography, layout and component presentation using `html[data-design]`.
Stored IDs (`original`, `shadcn`, `radix`, `material`) remain stable for existing users.

## Reference specifications

- **Vercel**: [Geist typography](https://vercel.com/geist/typography), [colors](https://vercel.com/geist/colors), [buttons](https://vercel.com/geist/button), [tabs](https://vercel.com/geist/tabs). Uses Geist, neutral surfaces, one-pixel dividers, workspace breadcrumbs and underline tabs.
- **Linear**: [UI design and hierarchy](https://linear.app/now/how-we-redesigned-the-linear-ui), [2026 interface refresh](https://linear.app/now/behind-the-latest-design-refresh). Uses Inter, a fixed sidebar, neutral panel layers, compact headers, controls and table rows. Accent remains an application choice.
- **Google**: [Material 3 foundations](https://m3.material.io/foundations/), [navigation rail](https://m3.material.io/components/navigation-rail/specs), [buttons](https://m3.material.io/components/buttons/specs). Uses Roboto, semantic surface roles, a 256px navigation drawer with horizontal labels and selected row containers (the portal has too many destinations for a compact rail), modal mobile drawer, labeled filled text fields, rounded actions and hover/pressed state layers.

These are portal-specific implementations of the published visual rules, not the vendors' application source code or pixel-identical copies. Portal-only views such as timetables and stage plots retain their interaction contracts. Japanese text uses the system's Japanese fallback font. Brand marks remain Jacla's.

## Implementation

- `app/design-presets.css`: tokens, component variants and desktop/mobile composition.
- `lib/designPresets.ts`: labels and stable preference IDs.
- `contexts/DesignPresetContext.tsx`: per-account saving, local restore, race protection.
- `components/DesignColorSettings.tsx`: optional account-wide color selected using a draggable/keyboard-accessible hue wheel, saturation/brightness sliders, swatches, a native picker or six-digit HEX input. A live local preview shows backgrounds, cards and accents before saving. Save applies it to every preset; reset restores each preset's own palette.
- `contexts/DesignColorContext.tsx`: stores `portal_design_color` in user metadata and a user-scoped local cache. Explicit null clears customization. Isolates account switches, failed saves and stale refreshes.
- `lib/designColors.ts` / `app/design-colors.css`: validated color input, first-paint restore, light/dark semantic accents and subtle tinted page/card/navigation surfaces. Adjusts luminance for readable links/buttons while preserving semantic status colors. PWA chrome tracks the tinted background. This is a portal color adaptation, not Material's HCT palette generation.
- `components/ui/button.tsx`: semantic variant and size hooks, with explicit screen heights preserved.
- `components/ui/input.tsx`: optional associated label and supporting text. Existing unlabeled inputs keep the same API.
- `components/DesignSystemPlayground.tsx`: interactive tabs, table, field and dialog examples in Theme settings.
- `public/fonts/design/`: self-hosted Latin variable fonts (100–900) and their SIL Open Font Licenses. No runtime Google Fonts request is needed. Sources: Google Fonts `ofl/geist`, `ofl/inter`, `ofl/roboto` and `fonts.gstatic.com`.

Theme references were reviewed on 2026-10-20. Visual parity is not asserted without browser review.

## Validation

```sh
node --test scripts/check-design-colors.cjs scripts/check-design-presets.cjs scripts/check-design-icons.cjs scripts/check-product-themes.cjs scripts/check-uncommitted-regressions.cjs
npm run build
```

Manually review `/me/appearance`, a band creation form, a member table and a timetable at 375px, 768px and 1440px in all four themes and both color modes. Check long Japanese labels, scrolling, keyboard focus, dialog dismissal, saved selection and the mobile menu. Live database changes and real-account updates are outside the isolated regression tests.
