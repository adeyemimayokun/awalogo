import { Plus } from "./icons";
import { formerBrandName, searchedHistoricalVersion } from "./brand-history";
import { brandCategory } from "./brand-category";
import { useV2Language } from "./V2Language";
import type { LogoWithSvg } from "./v2-brand-data";

export default function V2BrandCard({ logo, query, busy, reason, onOpen, onPack }: {
  logo: LogoWithSvg; query: string; busy: boolean; reason?: string;
  onOpen: (logo: LogoWithSvg) => void;
  onPack: (item: { slug: string; variation: string; format: string }, source: HTMLElement) => void;
}) {
  const { t } = useV2Language();
  const historical = searchedHistoricalVersion(logo.variations, query);
  const name = historical?.name ?? logo.name;
  const formats = historical?.formats ?? logo.formats;
  const former = formerBrandName(logo.slug);
  return <article className="v2-brand"><button className="v2-preview" onClick={() => onOpen(logo)} aria-label={t("View {name}", { name })}><img loading="lazy" src={formats.find((asset) => asset.type === "svg")?.url ?? formats[0]?.url} alt={`${name} logo`} /></button><div className="v2-card-label"><button onClick={() => onOpen(logo)}><strong>{name}{historical ? <span className="v2-former-name">{logo.name}{t(" (previous version)")}</span> : former ? <span className="v2-former-name">{t("Formerly {name}", { name:former })}</span> : null}</strong><small>{t(reason ?? brandCategory(logo.slug, logo.category))}</small></button><button className="v2-icon" disabled={busy} title={t("Pack into bag")} aria-label={`${t("Pack into bag")}: ${name}`} onClick={(event) => onPack({ slug:logo.slug, variation:historical?.id ?? "primary", format:formats[0].type }, event.currentTarget)}><Plus size={18} /></button></div></article>;
}
