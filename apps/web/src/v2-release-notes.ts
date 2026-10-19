// Preview-only notes: do not publish these through V1's shared editorial feeds.
import { logos } from "./v2-brand-data";
export const previewUpdates = [{
  id:"v2-preview-2026-10-18", title:"V2 preview: more brands, flags and a shared collection",
  summary:`The Coming soon preview combines ${logos.length} company entries and 249 flags. It adds reviewed Nigerian/African companies, historical 9mobile artwork, compact paginated browsing, search suggestions, a floating pack/drop bag, Nigerian languages, shortcuts and action sound preferences. V1 and the current plugin keep their existing catalogs. This is a preview implementation update, not a launch announcement.`,
  published_at:"2026-10-18", action_label:"Browse recent additions", action_href:"/v2?new=true", status:"published"
}];

export const previewChangelog = [{
  version:"V2 preview / 2026-10-18", date:"2026-10-18", title:"Coming soon preview improvements", status:"published",
  changes:[
    "Fixed dark-theme primary-action contrast and made copied logo/flag image URLs use the current deployment, including staging-only assets.",
    "Combined 228 unchanged financial logos with 84 independent reviewed company additions; added 249 separately licensed country/territory flags. V1 and the current Figma plugin remain unchanged.",
    "Added actual industry/category labels, multiple categories, country filters, popularity sorting and normalized name/alias search. Historical 9mobile artwork is a community-sourced previous version under T2, not the current primary logo.",
    "Added 20-item default pages for logos and flags, three previous/two next page links and first/last jumps. Search and filtered lists remain unpaginated.",
    "Added separate similar-brand suggestions from names and sourced affiliations, and name-only flag suggestions within active filters.",
    "Refined compact controls, light field focus states, primary request actions, centered empty states, one-click theme switching and accessible navigation utilities.",
    "Added a draggable floating download bag, pack animations, item count, anchored collection, Pack into bag, Drop item and Drop all with eight-second undo. Mixed ZIPs retain limits, provenance, checksums and the flag license.",
    "Added English, Hausa, Yoruba, Igbo and Nigerian Pidgin interface choices. Translations are drafts awaiting fluent review.",
    "Added contextual search, bag and request shortcuts, plus saved action sound preferences. Sounds start only after interaction and can be muted in More options.",
    "Kept logo reporting at the end of the detail panel and updated documentation. Owner publishing, colors, PDF guidelines, SEO and V2 plugin support remain pending; live browser/mobile/audio and deployment checks remain release gates."
  ]
}];
