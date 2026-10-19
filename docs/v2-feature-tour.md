# V2 Feature Tour

The short tour introduces discovery, country flags, the floating collection bag,
and preferences. Skip, close, Escape and completion all save the versioned
`awalogo-v2-tour-seen-v1` marker in local storage. It is remembered per browser,
not per account; clearing browser data makes the tour eligible again. Storage
failure does not prevent dismissal for the current mounted session.

Automatic display is disabled until `VITE_V2_LIVE=true` is included in an approved
production release. Only `https://awalogo.com/v2` and
`https://www.awalogo.com/v2` (and their `/v2/flags` routes) qualify. Preview,
private/inner pages and asset-query links do not auto-start the tour.
Local development servers on localhost or loopback addresses auto-start for unseen
visits so the first-visit experience can be tested before launch. This exception
requires Vite development mode and is not active in deployed builds. Clear local
site data (including local storage), not just the browser's file cache, to reset it.
Do not set this flag merely to test staging or publish this feature.

More options → Feature tour allows explicit replay, including in local/staging
previews. Replay returns to the logo library. It does not clear the seen marker.
Targets are remeasured on resize and scroll; hidden targets use a centered dialog.
The dialog contains keyboard focus and restores the previous control on dismissal.
No downloads, bag mutations, sound preference changes or analytics events are
triggered by the tour.
