import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "./icons";
import { useV2Language } from "./V2Language";
import "./v2-tour.css";

export const TOUR_KEY = "awalogo-v2-tour-seen-v1";
export function shouldStartTour(enabled: string | undefined, url: string, seen: boolean, development = false) {
  const page = new URL(url);
  const localPreview = development && ["localhost", "127.0.0.1", "[::1]"].includes(page.hostname);
  return (localPreview || enabled === "true" && ["https://awalogo.com", "https://www.awalogo.com"].includes(page.origin))
    && ["/v2", "/v2/flags"].includes(page.pathname) && !page.search && !seen;
}
const steps = [
  { target: ".v2-main .v2-search-wrap", title:"Find your next asset", copy:"Search by name and narrow the collection with filters." },
  { target: ".v2-topnav-links", title:"More than logos", copy:"Browse company logos or switch to country flags." },
  { target: ".v2-floating-bag", title:"Pack your collection", copy:"Pack assets into your movable bag, then download them together as a ZIP." },
  { target: ".v2-topnav-actions", title:"Make it yours", copy:"Choose your language, switch themes, or change action sounds in More options." }
];
export default function V2Tour() {
  const { t } = useV2Language();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<{ top:number; left:number; width:number; height:number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const sessionSeen = useRef(false);
  function start() { previousFocus.current = document.activeElement as HTMLElement; setStep(0); }
  function finish() {
    sessionSeen.current = true;
    try { localStorage.setItem(TOUR_KEY, "seen"); } catch { /* Remember for this session when storage is blocked. */ }
    setStep(null);
    requestAnimationFrame(() => {
      const target = previousFocus.current?.isConnected && previousFocus.current !== document.body ? previousFocus.current : document.querySelector<HTMLElement>('[aria-controls="v2-dock-more"]');
      target?.focus();
    });
  }
  useEffect(() => {
    let seen = sessionSeen.current;
    try { seen ||= localStorage.getItem(TOUR_KEY) === "seen"; } catch { /* Use session state. */ }
    if (shouldStartTour(import.meta.env.VITE_V2_LIVE, location.href, seen, import.meta.env.DEV)) start();
    const replay = () => start();
    window.addEventListener("awalogo:tour", replay);
    return () => window.removeEventListener("awalogo:tour", replay);
  }, []);
  useEffect(() => {
    if (step === null) return;
    const siblings = Array.from(panel.current?.parentElement?.parentElement?.children ?? []).filter((element): element is HTMLElement => element instanceof HTMLElement && !element.classList.contains("v2-tour-layer"));
    const previousInert = siblings.map((element) => element.inert);
    siblings.forEach((element) => { element.inert = true; });
    const update = () => {
      const target = document.querySelector(steps[step].target);
      const bounds = target?.getBoundingClientRect();
      setRect(bounds && bounds.width && bounds.height && bounds.bottom > 0 && bounds.top < innerHeight ? { top:Math.max(4,bounds.top-6), left:Math.max(4,bounds.left-6), width:Math.min(bounds.width+12,innerWidth-8), height:bounds.height+12 } : null);
    };
    update(); panel.current?.focus();
    const key = (event:KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); finish(); }
      else if (event.key === "Tab") {
        const items = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!items?.length) return;
        const first=items[0], last=items[items.length-1];
        if (event.shiftKey && (document.activeElement===first || document.activeElement===panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement===last || document.activeElement===panel.current)) { event.preventDefault(); first.focus(); }
      } else if (event.altKey || event.key === "/") { event.stopImmediatePropagation(); }
    };
    document.addEventListener("keydown",key,true);
    window.addEventListener("resize",update); window.addEventListener("scroll",update,true);
    return () => { siblings.forEach((element,index) => { element.inert = previousInert[index]; }); document.removeEventListener("keydown",key,true); window.removeEventListener("resize",update); window.removeEventListener("scroll",update,true); };
  }, [step]);
  if (step === null) return null;
  const top = rect && rect.top+rect.height+230 < innerHeight ? rect.top+rect.height+16 : rect && rect.top>250 ? rect.top-240 : Math.max(16,(innerHeight-240)/2);
  return <div className="v2-tour-layer">
    {rect ? <div className="v2-tour-spotlight" style={rect} /> : <div className="v2-tour-shade" />}
    <div ref={panel} className="v2-tour-dialog" role="dialog" aria-modal="true" aria-labelledby="v2-tour-title" aria-describedby="v2-tour-copy" tabIndex={-1} style={{ top, maxHeight:Math.max(120,innerHeight-top-16), left:rect ? Math.max(16,Math.min(rect.left,innerWidth-376)) : Math.max(16,(innerWidth-360)/2) }}>
      <header><span aria-live="polite">{t("Feature tour")} · {step+1}/{steps.length}</span><button aria-label={t("Skip tour")} title={t("Skip tour")} onClick={finish}><X size={18} /></button></header>
      <h2 id="v2-tour-title">{t(steps[step].title)}</h2><p id="v2-tour-copy">{t(steps[step].copy)}</p>
      <footer><button onClick={finish}>{t("Skip tour")}</button><div>{step>0 ? <button aria-label={t("Back")} title={t("Back")} onClick={() => setStep(step-1)}><ArrowLeft size={16} /></button> : null}<button className="v2-primary" onClick={() => step===steps.length-1 ? finish() : setStep(step+1)}>{t(step===steps.length-1 ? "Done" : "Next")}<ArrowRight size={16} /></button></div></footer>
    </div>
  </div>;
}
