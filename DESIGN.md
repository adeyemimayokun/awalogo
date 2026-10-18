# Awalogo V2 Design System

V2 is a quiet, neutral asset workspace. V1 remains unchanged. All rules are scoped to `.v2-app`.

## Foundations
- White canvas and surfaces `#ffffff`, charcoal `#252525` text, secondary `#70706e`, borders `#e5e5e2`. Avoid gray background fills: use outlines and weight for selection and hover. Dark preview surfaces are reserved for light artwork that requires contrast; dark primary actions and feedback retain their contrast.
- Native system sans, semibold headings, zero letter spacing. Desktop headings 32px, mobile 27px; body 12-14px.
- Spacing follows a 4px base. Repeated assets use 8px corners; floating navigation 20px; detail panels 16px. Sections remain unframed.

## Layout
- Desktop: full-width heading, search, and four-column gallery. A compact floating bottom dock exposes Library, Categories, Bag, Request, and More. Categories, brand counts, and V1 links expand on interaction rather than occupying persistent sidebar space.
- Mobile: bottom dock with labeled icons, safe-area spacing, single-column assets, and full-width search and category controls. Popovers remain within the viewport and close on selection, outside interaction, or Escape.
- Details, downloads, sharing, code tools, and requests share the same visual language.
- V2 remains coming soon. The existing V1 interface remains at the root URL.

## Interaction
- Restrained preview lift, press feedback, panel entrance, and focused search treatment.
- Visible keyboard focus, accessible icon labels, 44px primary touch targets, existing dialog focus trapping and Escape dismissal.
- Reduced-motion preferences disable decorative animation and transitions.
- Asset integrity checks, persisted download bag, request API, and clipboard feedback remain unchanged.
