# Awalogo V2 Design System

V2 is a quiet, neutral asset workspace. V1 remains unchanged. All rules are scoped to `.v2-app`.

## Foundations
- White canvas and surfaces `#ffffff`, charcoal `#252525` text, secondary `#70706e`, borders `#e5e5e2`. Avoid gray background fills: use outlines and weight for selection and hover. Dark preview surfaces are reserved for light artwork that requires contrast; dark primary actions and feedback retain their contrast.
- Native system sans, semibold headings, zero letter spacing. Desktop headings 32px, mobile 27px; body 12-14px.
- Spacing follows a 4px base. Repeated assets use 8px corners; form fields and navigation controls share a 12px radius; collection panels use 16px. Sections remain unframed.

## Layout
- Desktop: full-width heading, search, and four-column gallery. Top navigation exposes Browse, Categories, Flags, plugin/updates and utility menus. Request logo is a primary action with explicit contrasting text/icons; the empty-logo request CTA is primary too.
- Mobile: responsive top navigation with compact utility icons, scrollable section links, and full-width search/category controls. Popovers remain inside the viewport. No persistent sidebar or bottom navigation dock.
- The independently draggable floating bag uses a blue shopping-bag silhouette, visible packed-asset previews and a green count badge, not a dark circular backing. Its collection opens anchored to the icon, with separate header, scrollable rows and download footer.
- Logo/flag default lists use shared 20-item pagination with three previous/two next links and start/end jumps. Search suggestions are a separate unframed section. Empty messages/actions are centered within results.
- Details, downloads, sharing, code tools, and requests share the same visual language.
- V2 remains coming soon. The existing V1 interface remains at the root URL.

## Interaction
- Restrained preview lift, press feedback, panel entrance, and focused search treatment.
- Visible keyboard focus, accessible icon labels, 44px primary touch targets, existing dialog focus trapping and Escape dismissal.
- Reduced-motion preferences disable decorative animation and transitions.
- Asset integrity checks, persisted download bag, request API, and clipboard feedback remain unchanged.
- Standard desktop controls are 36px high, search 40px, and coarse-pointer targets at least 44px. Keep textareas comfortable and field borders light in both themes.
- Pack animations respect reduced motion. Drop all offers eight-second undo; ZIP preparation locks mutations. Interface language, theme, bag position/content and sound choices persist locally when storage is available.
- Search, bag and request shortcuts are exposed in tooltips/accessibility attributes, not permanent toolbar instructions. Sounds are enabled after user interaction unless muted, never during page load, typing, hover or drag.
- Logo reporting is the last detail-panel section with clear spacing. Flags share appropriate browsing/bag behavior, not corporate affiliation or logo-report semantics.
