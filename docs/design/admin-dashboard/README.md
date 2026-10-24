# Admin dashboard visual direction

Seven separate horizontal references generated with the imagegen-frontend-web skill, covering Overview, Assets, Requests & reports, Updates, Analytics, Plugin, and Notifications.

The implemented interface uses a 216px navigation rail, neutral workspace canvas, white work panels, restrained borders, compact system typography, and lime accents. Dark mode uses equivalent semantic surfaces. Mobile navigation becomes an accessible drawer.

These images are visual references. Catalog content, publication status, counts, and integration availability come from the application. Text or figures invented by image generation are not product requirements or published data.

## V2 component alignment

The implemented admin now follows the website's V2 design rather than the lime-accented reference palette. `packages/catalog-ui/src/v2-tokens.css` supplies shared neutral colors, light/dark surfaces, focus color, and control radii. Both the website and admin use `WorkspaceSelect`, with native select semantics and a decorative chevron; multiple selects retain their list presentation. Admin primary actions use `WorkspaceButton` and the same ink/surface contrast as V2. `admin-workspace.css` owns the dashboard layout and maps legacy admin tokens to these foundations. Status colors remain semantic.
