export function V2Developers() {
  return <main className="v2-main v2-about-page v2-developers">
    <a className="v2-about-back" href="/">Brand library</a>
    <article lang="en" className="v2-about-story">
      <header>
        <h1>For Developers</h1>
        <p className="v2-about-intro">Bundle Nigerian bank and fintech logos with your app, without a runtime dependency on Awalogo.</p>
      </header>
      <section>
        <h2>Supported catalog</h2>
        <p>Use the <a href="/catalog/v1/catalog.json">public V1 JSON catalog</a>. No API key or npm package is required. The <code>schema_version</code> identifies the response shape; <code>catalog_version</code> identifies a particular revision. This feed does not include every brand on the website or any flags.</p>
        <p>Read assets from <code>items[].logo.formats</code>. Resolve the returned <code>url</code> against the catalog URL instead of constructing a path. Each format includes a SHA-256 <code>checksum</code>.</p>
      </section>
      <section>
        <h2>Map your institution IDs</h2>
        <pre><code>{'{\n  "access": "access-bank",\n  "gtb": "guaranty-trust-bank"\n}'}</code></pre>
        <p>The keys are IDs from your app; the values are <code>items[].logo.slug</code> in the catalog. For an unmapped ID, show the institution name or a neutral placeholder rather than guessing.</p>
      </section>
      <section>
        <h2>Download and bundle</h2>
        <p>From a checkout of the <a href="https://github.com/adeyemimayokun/awalogo/tree/main/examples/fintech-logos">GitHub example</a>, run this command at the repository root with Node.js 22 or newer:</p>
        <pre><code>node examples/fintech-logos/download.mjs ./public/logos</code></pre>
        <p>The script prefers SVG, falls back to PNG, verifies every checksum, and writes <code>manifest.json</code> keyed by your institution IDs. Read the manifest at build time. For example, when your app serves the output folder at <code>/logos</code>:</p>
        <pre><code>{'const src = manifest.logos.access.file;\n// React\n<img src={`/logos/${src}`} alt="Access Bank" width={120} />'}</code></pre>
        <p>Review and pin the generated assets and manifest before shipping. Failed downloads or invalid catalog entries leave the previous bundle available.</p>
      </section>
      <section>
        <h2>Brand permissions</h2>
        <p>Awalogo's code license does not grant rights to the logos. Review the artwork and the brand owner's usage guidelines before using it in your app.</p>
      </section>
    </article>
  </main>;
}
