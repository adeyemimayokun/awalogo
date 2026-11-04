# Bundle Awalogo logos into a fintech app

From the repository root, run with Node.js 22 or newer:

```sh
node examples/fintech-logos/download.mjs ./public/logos
```

Edit [mapping.json](mapping.json) to map your app's institution IDs to Awalogo
slugs. This example uses the supported [V1 JSON catalog](https://www.awalogo.com/catalog/v1/catalog.json),
which does not include every V2 brand or any flags.

Import the generated `manifest.json` at build time. With the bundle served at
`/logos`, render the matching entry or show the institution name:

```jsx
const logo = manifest.logos[institution.id];
return logo
  ? <img src={`/logos/${logo.file}`} alt={institution.name} width={120} />
  : <span>{institution.name}</span>;
```

Review and pin the manifest and the files it references before deploying.
Awalogo's code license does not grant rights to the logos.
See the [For Developers guide](https://www.awalogo.com/developers) for details.
