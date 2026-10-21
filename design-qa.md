# V2 Search Hero QA

Date: 2026-10-21

## Reference And Scope

- Source: `/Users/user/.codex/generated_images/01a1386a-fa73-74f0-9636-1350b5b8ed7d/exec-c0a17913-cd4d-462a-9ec2-6fe1cff05dee.png` (third displayed concept).
- Implementation: `/tmp/search-hero-1440-light.png`.
- Combined comparison: `/tmp/hero-design-comparison.png`.
- Desktop viewport: 1440 x 960 CSS pixels, device scale 1.
- Source raster: 1536 x 1024; proportionally normalized to 1440 x 960. Implementation raster: 1440 x 960.
- State: English, light theme, default library, empty bag, first-visit tour already completed.
- Additional checks: 390 and 768 widths, both themes, Hausa, Yoruba, Igbo, Nigerian Pidgin.

## Intentional Differences

The user's instructions preserve current copy, design specifications, and everything outside the hero. The implementation therefore retains existing navigation, logo artwork, sorting, filters, result cards, and floating bag. It keeps the original headline, description, eyebrow and brand count rather than the concept's replacement wording. A subsequent request added shared logo/flag search: the placeholder and accessible search label now reflect both resources, matching flags appear first in a separate section, and the default homepage remains logo-only. Existing category and industry filters apply to logos; operating-market selection also constrains flags by country code. No recent-search feature was introduced. Existing 40px desktop search and 36px controls are preserved instead of the larger concept controls. Coarse-pointer controls retain at least 44px targets.

## Findings

No actionable P0/P1/P2 findings within the agreed hero scope. The full-view comparison shows the centered headline, search-first hierarchy, inline category filter and icon-led quick access. A separate focused crop was unnecessary because the combined full-view image keeps the hero readable at the same normalized scale.

## Verification

- One search input, moved into the hero rather than duplicated.
- Live search, clear, Enter submission and result-heading focus work.
- Existing category popup opens inside viewport and closes with Escape.
- Flags shortcut switches to the existing flag page; browser Back restores logos.
- Bag and request shortcuts open existing panels; Escape closes them.
- Figma link retains its existing destination and opens separately.
- No heading or control text overflow in supported languages.
- No page errors during browser verification.
- Desktop four-column library remains unchanged; no catalog or legacy asset edits.
- All 282 tests pass across 75 files. Type checking and production build pass.
- Shared search verified on mobile and desktop in both themes: country names/codes, logo matches, no false empty state for flag-only matches, flag detail panels, packing both resources, mixed ZIP downloads, clearing and Enter focus.
- V2 uses the MIT-licensed `@boxicons/react` free Basic pack through `apps/web/src/icons.tsx`. All 30 action mappings have rendered SVG paths and fixed dimensions, with inherited `currentColor` foregrounds. No Pro assets or simulated duotone artwork are used. V1 and the Figma plugin retain their original icon libraries.
- Boxicons browser verification covers browse, flags, About and request pages at 390px and 1440px, in both themes, including theme-toggle destination icons. Evidence: `/tmp/boxicons-1440-light.png`, `/tmp/boxicons-1440-dark.png`, and mobile counterparts.
- Legacy checksum verification: all 1,703 protected files unchanged.

## Comparison History

Initial visual comparison passed with the user-approved intentional differences above. No P0/P1/P2 visual fixes were required. Browser testing initially encountered the development first-visit tour; the test was corrected to mark the tour complete before exercising underlying controls, without changing tour behavior.

final result: passed
