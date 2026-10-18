import updates from "../../../packages/catalog-ui/src/site-updates.json";
import changelog from "../../../packages/catalog-ui/src/changelog.json";
import { ArrowUpRight } from "lucide-react";

export type InfoPage = "updates" | "changelog" | "about" | "usage" | "contribute" | "help";
export const infoTitles: Record<InfoPage, string> = {
  updates: "Latest updates", changelog: "Changelog", about: "About awalogo",
  usage: "Trademark & usage", contribute: "Contribute", help: "Help & documentation"
};
const github = "https://github.com/adeyemimayokun/awalogo";
export default function V2Info({ page, onBrand, onNewest, onRequest }: { page: InfoPage; onBrand: (slug: string) => void; onNewest: () => void; onRequest: () => void }) {
  return <div className="v2-info"><p className="v2-eyebrow">AWALOGO</p><h2>{infoTitles[page]}</h2>
    {page === "updates" ? updates.filter((item) => item.status === "published").sort((a, b) => b.published_at.localeCompare(a.published_at)).map((item) => {
      const action = new URL(item.action_href, "https://www.awalogo.com");
      const slug = action.searchParams.get("logo")?.replace(/\/+$/, "");
      return <article key={item.id}><time>{item.published_at}</time><h3>{item.title}</h3><p>{item.summary}</p>{slug ? <button onClick={() => onBrand(slug)}>{item.action_label} <ArrowUpRight size={14} /></button> : action.searchParams.has("new") ? <button onClick={onNewest}>{item.action_label} <ArrowUpRight size={14} /></button> : <a href={item.action_href} target="_blank" rel="noreferrer">{item.action_label} <ArrowUpRight size={14} /></a>}</article>;
    }) : null}
    {page === "changelog" ? changelog.filter((item) => item.status === "published").sort((a, b) => b.date.localeCompare(a.date)).map((item) => <article key={item.version}><time>{item.date} / {item.version}</time><h3>{item.title}</h3><ul>{item.changes.map((change) => <li key={change}>{change}</li>)}</ul></article>) : null}
    {page === "about" ? <><p>awalogo is an open-source library of Nigerian bank and financial institution logos, built for designers and developers.</p><p>Browse current artwork, variations, and previous versions. Download individual assets, collect a ZIP bundle, or copy code for your project.</p><a href={github} target="_blank" rel="noreferrer">Explore the project on GitHub <ArrowUpRight size={14} /></a></> : null}
    {page === "usage" ? <><p>Logos remain trademarks of their respective owners. Downloading an asset does not grant ownership or permission to imply endorsement, partnership, or affiliation.</p><p>Check the institution's official website and brand guidelines before use. Verification describes the source of the artwork, not permission to use the trademark.</p></> : null}
    {page === "contribute" ? <><p>Help improve the collection by reporting outdated artwork, requesting a missing brand, or contributing official assets.</p><button onClick={onRequest}>Request a brand <ArrowUpRight size={14} /></button><a href={`${github}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">Contribution guidelines <ArrowUpRight size={14} /></a><a href={`${github}/issues`} target="_blank" rel="noreferrer">Report an issue <ArrowUpRight size={14} /></a></> : null}
    {page === "help" ? <><h3>Find an asset</h3><p>Search by brand name and use categories to narrow the collection. Sorting includes popularity, alphabetical order, and recently added assets.</p><h3>Download and reuse</h3><p>Open a logo to choose its format or version. Add assets to your bag for a ZIP download, or copy HTML, React, or available SVG code.</p><h3>Missing something?</h3><button onClick={onRequest}>Request a brand <ArrowUpRight size={14} /></button><a href="/docs" target="_blank" rel="noreferrer">Full documentation <ArrowUpRight size={14} /></a></> : null}
  </div>;
}
