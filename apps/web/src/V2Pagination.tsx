import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "./icons";
import { pageWindow } from "./browse-tools";
import { useV2Language } from "./V2Language";

export default function V2Pagination({ current, pages, start, end, total, onChange }: { current:number; pages:number; start:number; end:number; total:number; onChange:(page:number) => void }) {
  const { t } = useV2Language();
  if (pages <= 1) return null;
  return <nav className="v2-pagination" aria-label={t("Result pages")}><button disabled={current === 1} onClick={() => onChange(1)} aria-label={t("First page")} title={t("First page")}><ChevronFirst size={16} /></button><button disabled={current === 1} onClick={() => onChange(current - 1)} aria-label={t("Previous page")} title={t("Previous page")}><ChevronLeft size={16} /></button>{pageWindow(current, pages).map((number) => <button key={number} aria-label={t("Page {number}", { number })} aria-current={current === number ? "page" : undefined} onClick={() => onChange(number)}>{number}</button>)}<button disabled={current === pages} onClick={() => onChange(current + 1)} aria-label={t("Next page")} title={t("Next page")}><ChevronRight size={16} /></button><button disabled={current === pages} onClick={() => onChange(pages)} aria-label={t("Last page")} title={t("Last page")}><ChevronLast size={16} /></button><p>{t("{start}–{end} of {total}", { start, end, total })}</p></nav>;
}
