import { Plus } from "./icons";
import type { CountryFlag } from "./flags-data";
import { useV2Language } from "./V2Language";

type Pick = { slug: string; variation: string; format: string };
export default function V2FlagCard({ flag, recommended = false, busy = false, onSelect, onAdd }: { flag: CountryFlag; recommended?: boolean; busy?: boolean; onSelect: (flag: CountryFlag) => void; onAdd: (item: Pick, source?: HTMLElement) => void }) {
  const { t } = useV2Language();
  return <article className="v2-brand" data-resource="flag"><button className="v2-preview v2-flag-preview" aria-label={t("View {name}", { name:`${flag.name} ${t("flag")}` })} onClick={() => onSelect(flag)}><img src={flag.variants[0].formats[0].url} loading="lazy" alt={`${flag.name} flag`} width={104} height={78} /></button><div className="v2-card-label"><button onClick={() => onSelect(flag)}><strong>{flag.name}</strong><small>{recommended ? t("Similar name") : `${flag.code} / ${t(flag.region)}`}</small></button><button className="v2-icon" disabled={busy} title={t("Pack into bag")} aria-label={`${t("Pack into bag")}: ${flag.name}`} onClick={(event) => onAdd({ slug:`flag-${flag.code.toLowerCase()}`, variation:"4x3", format:"svg" }, event.currentTarget)}><Plus size={18} /></button></div></article>;
}
