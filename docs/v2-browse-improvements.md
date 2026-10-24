# V2 browsing and collection improvements

Seven independent behaviors are implemented without changing catalog records or V1:

1. Compact controls: 36px desktop commands/fields, 40px search, 44px coarse-pointer targets. Existing field radius and focus styling remain.
2. Request CTA: primary navigation and centered empty-logo-state treatment; opens the existing request panel. Navigation primary text/icons explicitly override muted dock styles in both themes.
3. Pack/drop: individual drop, bulk drop with an 8-second undo, mutation locking during ZIP preparation. Later mutations dismiss the undo snapshot.
4. Pagination: 20 results for unfiltered logos (after sorting) and unfiltered flags. Search/filter results are unpaginated. Sort/filter changes reset the page. Both views share a current-page window with up to three previous and two next pages, plus first/last jumps.
5. Recommendations: up to eight, at least 0.65 normalized Damerau-Levenshtein similarity, or explicit sourced affiliation. Direct matches are excluded, active filters apply, and affiliations rank first. Equal scores sort by name then slug.
6. Shortcuts: `/` search, `Alt+B` collection, `Alt+R` request, existing Escape closes the active layer. Typing, composition, repeats, and conflicting modifiers are ignored. Tooltips and `aria-keyshortcuts` expose bindings.
7. Sound: enabled after interaction by user confirmation, never on load. More options has a persisted Action sounds toggle. A lazy Web Audio service generates short low-volume tones; rapid repeats are throttled and errors are non-blocking.

Flag browsing also has accent/punctuation-normalized name/code search, up to eight same-filter name suggestions, contextual navigation search and `/` shortcut, and a centered empty state with a primary reset action. Recommendations do not infer political affiliations or visual similarity. Existing flag pack/drop, undo, shared sounds, previews, copy/share, and mixed ZIP behavior remain intact.

Affiliations are maintained separately in `packages/brands/research/affiliations.json`. Add only reviewed relationships with an HTTPS primary-source URL and existing brand slugs. The initial Sonatel/Orange Côte d'Ivoire link is supported by Orange Wholesale's May 2026 Via Africa announcement, which identifies both as Orange Group entities. Industry peers alone are not affiliations.

New interface translations are drafts, consistent with existing V2 language review status. No backend schema, public API, V1, or plugin change is required.
