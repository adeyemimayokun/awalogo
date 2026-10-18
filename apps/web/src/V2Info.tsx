import legacyUpdates from "../../../packages/catalog-ui/src/site-updates.json";
import legacyChangelog from "../../../packages/catalog-ui/src/changelog.json";
import { previewUpdates, previewChangelog } from "./v2-release-notes";
import { ArrowUpRight } from "lucide-react";
import { useV2Language } from "./V2Language";

export type InfoPage = "updates" | "changelog" | "about" | "usage" | "contribute" | "help";
export const infoTitles: Record<InfoPage, string> = {
  updates: "Latest updates", changelog: "Changelog", about: "About awalogo",
  usage: "Trademark & usage", contribute: "Contribute", help: "Help & documentation"
};
const github = "https://github.com/adeyemimayokun/awalogo";
const updates = [...previewUpdates, ...legacyUpdates];
const changelog = [...previewChangelog, ...legacyChangelog];
export default function V2Info({ page, onBrand, onNewest, onRequest }: { page: InfoPage; onBrand: (slug: string) => void; onNewest: () => void; onRequest: () => void }) {
  const { t } = useV2Language();
  return <div className="v2-info"><p className="v2-eyebrow">AWALOGO</p><h2>{t(infoTitles[page])}</h2>
    {page === "updates" || page === "changelog" ? <p>{t("Editorial updates are currently available in English.")}</p> : null}
    {page === "updates" ? updates.filter((item) => item.status === "published").sort((a, b) => b.published_at.localeCompare(a.published_at)).map((item) => {
      const action = new URL(item.action_href, "https://www.awalogo.com");
      const slug = action.searchParams.get("logo")?.replace(/\/+$/, "");
      return <article key={item.id}><time>{item.published_at}</time><h3>{item.title}</h3><p>{item.summary}</p>{slug ? <button onClick={() => onBrand(slug)}>{item.action_label} <ArrowUpRight size={14} /></button> : action.searchParams.has("new") ? <button onClick={onNewest}>{item.action_label} <ArrowUpRight size={14} /></button> : <a href={item.action_href} target="_blank" rel="noreferrer">{item.action_label} <ArrowUpRight size={14} /></a>}</article>;
    }) : null}
    {page === "changelog" ? changelog.filter((item) => item.status === "published").sort((a, b) => b.date.localeCompare(a.date)).map((item) => <article key={item.version}><time>{item.date} / {item.version}</time><h3>{item.title}</h3><ul>{item.changes.map((change) => <li key={change}>{change}</li>)}</ul></article>) : null}
    {page === "about" ? <><p>{t("Nigerian and African company logos, plus country flags, for designers and developers.")}</p><p>{t("V2 is a Coming soon preview. V1 and the current Figma plugin keep their existing catalogs.")}</p><p>{t("Official and community artwork retain distinct sources. Logos remain their owners' trademarks.")}</p><a href={github} target="_blank" rel="noreferrer">{t("Explore the project on GitHub")}<ArrowUpRight size={14} /></a></> : null}
    {page === "usage" ? <><p>{t("Logos remain trademarks of their respective owners. Downloading an asset does not grant ownership or permission to imply endorsement, partnership, or affiliation.")}</p><p>{t("Official and community artwork retain distinct sources. Logos remain their owners' trademarks.")}</p><p>{t("Flag artwork has a separate MIT license and standardized proportions, not guaranteed national proportions.")}</p></> : null}
    {page === "contribute" ? <><p>{t("Help improve the collection by reporting outdated artwork, requesting a missing brand, or contributing official assets.")}</p><button className="v2-primary" onClick={onRequest}>{t("Request a brand")}<ArrowUpRight size={14} /></button><a href={`${github}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">{t("Contribution guidelines")}<ArrowUpRight size={14} /></a><a href={`${github}/issues`} target="_blank" rel="noreferrer">{t("Report an issue")}<ArrowUpRight size={14} /></a></> : null}
    {page === "help" ? <><h3>{t("Find an asset")}</h3><p>{t("Logos support name, former-name, category, industry and market search. Flags support names, codes and regions.")}</p><p>{t("Default lists show 20 items per page. Search and filtered results stay on one list.")}</p><p>{t("Suggestions use similar names or sourced company links, never inferred ownership.")}</p><h3>{t("Download and reuse")}</h3><p>{t("Pack into bag, drop individual items, or drop all with an eight-second undo. Mixed ZIPs include flag licensing.")}</p><p>{t("Open an asset for formats, code and sharing. Report logo issues at the bottom of its panel.")}</p><h3>{t("Preferences")}</h3><p>{t("Choose a language or theme, and mute action sounds in More options. Shortcut hints appear in tooltips.")}</p><h3>{t("Missing something?")}</h3><button className="v2-primary" onClick={onRequest}>{t("Request a brand")}<ArrowUpRight size={14} /></button><a href="/docs#v2" target="_blank" rel="noreferrer">{t("Full documentation")}<ArrowUpRight size={14} /></a></> : null}
  </div>;
}
