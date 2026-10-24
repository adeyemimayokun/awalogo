# V2 Company Expansion

This collection is independent of the original logo, institution and plugin catalogs.
Never edit existing artwork to accommodate this campaign. Identity collisions need
a separate correction/replacement proposal, not a migration.

- `research/candidates.json`: 100 research candidates, not 100 promised additions.
- `research/supplemental-candidates.json`: subsequently requested companies, separate from the original campaign.
- `research/source-overrides.json`: reviewed official fallback pages and searchable brand aliases.
- `research/manifest.json`: official-page evidence and staged asset provenance.
- `research/reviews.json`: explicit artwork and operating-market review decisions.
- `research/source-report.md`: final disposition of every candidate.
- `assets/`: approved original source bytes; reproducible builds need no network.
- `catalog.json`: generated V2-only projection. V1 never imports this file.
- `research/telecom-brand-history.json`: former-name display evidence.
- `research/historical-assets.json` and `historical-catalog.json`: reviewed historical
  variations and generated formats, without replacing the current primary artwork.
- `research/affiliations.json`: explicitly sourced V2 corporate links for suggestions;
  no inferred ownership from industry/name/logo similarity.
- `legacy-baseline.json`: checksums captured before the expansion.

Run `pnpm brands:research` to investigate candidates. Staging is private and ignored.
Use `node scripts/research-brands.mjs --refresh --only=shoprite,globacom` for a focused retry.
Discovery ranks header identities, supports lazy images and embedded brand SVGs,
and follows official logo download links. Discovery never approves artwork.
Review the actual artwork and official company evidence before adding a decision.
Unknown origin and headquarters are null, not inferred from a target market.
Official-source verification describes provenance, not a trademark licence.
Community artwork must use `community-catalog` and `needs-review`.

Run `pnpm brands:publish` to build content-hashed public assets, then
`pnpm brands:check` to verify deterministic output and the legacy snapshot.
Each named batch is limited to 25 additions. Shared domains require an explicit
identity-resolution note; slug, alias and normalized legal-name collisions fail.
Do not overwrite the baseline to make a failing check pass.

Website builds regenerate static V2 assets before deployment. V2 remains Coming
soon. The current Figma plugin continues using `/catalog/v1`; supporting this
collection in the plugin requires a separate compatibility release.

As of 18 October 2026, 84 independent company additions combine with 228 existing
logos in V2 (312 companies). Telecom coverage tracks 89 candidates, of which 41
are available; this is not an exhaustive operator list. See the
[telecom audit](../../docs/nigerian-telecom-audit.md). Historical 9mobile remains a
community-sourced previous version under T2; spaced-name search selects its artwork.
The publisher also generates historical formats and verifies their source checksums.
