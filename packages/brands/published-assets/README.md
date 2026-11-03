# Pinned Published Outputs

These are byte-identical copies of already-published V2 artwork, addressed by
their existing SHA-256 checksums. They are not new logos or replacement artwork.
Generated public catalog directories are ignored by Git; this archive lets a
fresh checkout restore the reviewed bytes after image-renderer security updates.

The render cache requires a pinned input/recipe fingerprint, unchanged format
records, and matching output bytes. Every restored SVG also passes the shared
security policy. Missing generated output may fall back here; corrupt output or
authorization failures are never silently replaced. New or changed source artwork
still requires review, validation, and rendering through the normal publisher.

Do not re-render or overwrite these files to accommodate a dependency update.
Keep the existing source provenance and catalog records unchanged.
