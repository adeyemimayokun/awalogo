import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useV2Language } from "./V2Language";

export type CategoryOption = { value: string; count: number };
export function CategoryChoices({ options, selected, onToggle, onDone }: { options: CategoryOption[]; selected: string[]; onToggle: (value: string) => void; onDone: () => void }) {
  const { t } = useV2Language();
  return <>
    <div className="v2-category-heading"><strong>{t("Categories")}</strong>{selected.length > 0 ? <button onClick={() => onToggle("all")}>{t("Clear")}</button> : null}</div>
    <div className="v2-category-options" role="group" aria-label={t("Select categories")}>
      {options.map(({ value, count }) => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} /><span>{t(value.replaceAll("-", " "))}</span><small>{count}</small></label>)}
    </div>
    <button className="v2-category-done" onClick={onDone}>{t("Done")}</button>
  </>;
}

export default function V2CategoryFilter({ options, selected, onToggle }: { options: CategoryOption[]; selected: string[]; onToggle: (value: string) => void }) {
  const { t } = useV2Language();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="v2-category-filter" ref={ref} onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={trigger} className="v2-category-trigger" aria-label={t("Filter by categories")} aria-expanded={open} aria-controls="v2-category-options" onClick={() => setOpen(!open)}><span>{selected.length === 0 ? t("All categories") : t("{count} selected", { count: selected.length })}</span><ChevronDown size={16} /></button>
    {open ? <div className="v2-category-popover" id="v2-category-options"><CategoryChoices options={options} selected={selected} onToggle={onToggle} onDone={() => { setOpen(false); trigger.current?.focus(); }} /></div> : null}
  </div>;
}
