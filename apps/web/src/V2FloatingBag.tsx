import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ShoppingBag, X } from "./icons";
import V2CollectionFolder, { type CollectionPreview } from "./V2CollectionFolder";
import { useV2Language } from "./V2Language";
import { assetFlight, bagPopoverLayout, BAG_POSITION_KEY, constrainBag, restoreBag, type BagPosition } from "./floating-bag";
import "./v2-floating-bag.css";

export type BagAddition = { id: number; url?: string; start: BagPosition };

function FlyingAsset({ addition, target, onLand }: { addition: BagAddition; target: BagPosition; onLand: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || matchMedia("(prefers-reduced-motion: reduce)").matches) { onLand(addition.id); return; }
    const animation = ref.current.animate(assetFlight(addition.start, target), { duration: 680, easing: "cubic-bezier(.32,.05,.67,1)", fill: "both" });
    animation.onfinish = () => onLand(addition.id);
    return () => animation.cancel();
  }, [addition, target, onLand]);
  return <div ref={ref} className="v2-bag-flight" aria-hidden="true">{addition.url ? <img src={addition.url} alt="" /> : <ShoppingBag size={24} />}</div>;
}

export default function V2FloatingBag({ count, addition, onOpen, panelOpen, open = false, onClose, children, previews = [] }: { count: number; addition: BagAddition | null; onOpen: () => void; panelOpen: boolean; open?: boolean; onClose?: () => void; children?: ReactNode; previews?: CollectionPreview[] }) {
  const { t } = useV2Language();
  const button = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [position, setPosition] = useState<BagPosition | null>(null);
  const currentPosition = useRef<BagPosition | null>(null);
  const customized = useRef(false);
  const drag = useRef<{ id: number; start: BagPosition; origin: BagPosition; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [flights, setFlights] = useState<Array<{ addition: BagAddition; target: BagPosition }>>([]);
  const [landing, setLanding] = useState(0);
  useEffect(() => {
    if (!open) return;
    popup.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) close.current?.();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close.current?.(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      button.current?.focus();
    };
  }, [open]);
  function move(next: BagPosition) { currentPosition.current = next; setPosition(next); }
  function persist(next: BagPosition) {
    customized.current = true;
    try { localStorage.setItem(BAG_POSITION_KEY, JSON.stringify({ x: next.x / innerWidth, y: next.y / innerHeight })); } catch { /* Dragging still works without storage. */ }
  }
  useEffect(() => {
    let saved: unknown;
    try { saved = JSON.parse(localStorage.getItem(BAG_POSITION_KEY) ?? "null"); } catch { saved = null; }
    const candidate = saved as BagPosition | null;
    customized.current = !!candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
    move(restoreBag(saved, innerWidth, innerHeight));
    const resize = () => {
      const next = customized.current && currentPosition.current ? constrainBag(currentPosition.current, innerWidth, innerHeight) : restoreBag(null, innerWidth, innerHeight);
      move(next);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!addition) return;
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    setFlights((items) => [...items, { addition, target: { x: rect.x + rect.width / 2, y: rect.y + 18 } }].slice(-8));
  }, [addition]);
  const land = useCallback((id: number) => {
    setFlights((items) => items.filter((item) => item.addition.id !== id));
    setLanding((value) => value + 1);
  }, []);
  const label = count ? t("Download bag, {count} assets", { count }) : t("Download bag");
  return <>
    <button ref={button} type="button" className={`v2-floating-bag${dragging ? " is-dragging" : ""}`} style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined}
      aria-keyshortcuts="Alt+B" aria-label={label} title={`${label} (Alt+B). ${t("Drag to move; use arrow keys when focused.")}`} aria-describedby="v2-bag-move-help" aria-hidden={panelOpen || undefined} tabIndex={panelOpen ? -1 : 0}
      aria-expanded={open} aria-controls={open ? "v2-bag-collection" : undefined} aria-haspopup="dialog"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        drag.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { x: rect.x, y: rect.y }, moved: false };
        suppressClick.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const active = drag.current;
        if (!active || active.id !== event.pointerId) return;
        const dx = event.clientX - active.start.x; const dy = event.clientY - active.start.y;
        if (!active.moved && Math.hypot(dx, dy) < 6) return;
        active.moved = true; suppressClick.current = true; setDragging(true);
        move(constrainBag({ x: active.origin.x + dx, y: active.origin.y + dy }, innerWidth, innerHeight));
      }}
      onPointerUp={() => { if (drag.current?.moved && currentPosition.current) persist(currentPosition.current); drag.current = null; setDragging(false); }}
      onPointerCancel={() => { drag.current = null; setDragging(false); suppressClick.current = true; }}
      onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
      onClick={(event) => { if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; } onOpen(); }}
      onKeyDown={(event) => {
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect(); const step = event.shiftKey ? 40 : 12;
        const next = event.key === "Home" ? restoreBag(null, innerWidth, innerHeight) : constrainBag({ x: rect.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0), y: rect.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0) }, innerWidth, innerHeight);
        move(next); persist(next);
      }}>
      <span key={landing} className={`v2-bag-body${landing ? " has-landed" : ""}`}><V2CollectionFolder previews={previews} /></span>
      <span className="v2-floating-bag-count" aria-hidden="true">{count}</span>
    </button>
    {open && position ? <div ref={popup} id="v2-bag-collection" role="dialog" aria-label={t("Download bag")} className="v2-panel v2-bag-popover" style={bagPopoverLayout(position, innerWidth, innerHeight)} onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== button.current) close.current?.();
    }}><button className="v2-close" aria-label={t("Close panel")} onClick={onClose}><X size={18} /></button>{children}</div> : null}
    <span id="v2-bag-move-help" className="v2-bag-sr">{t("Drag to move; use arrow keys when focused.")}</span>
    {flights.map((flight) => <FlyingAsset key={flight.addition.id} {...flight} onLand={land} />)}
  </>;
}
