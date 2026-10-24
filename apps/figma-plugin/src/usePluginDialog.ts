import { useEffect, useRef } from "react";

export function usePluginDialog(dialogKey: string | null) {
  const lastOutsideFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    function rememberFocus(event: FocusEvent) {
      if (event.target instanceof HTMLElement && !event.target.closest(".detail-sheet")) lastOutsideFocus.current = event.target;
    }
    if (document.activeElement instanceof HTMLElement) lastOutsideFocus.current = document.activeElement;
    document.addEventListener("focusin", rememberFocus);
    return () => document.removeEventListener("focusin", rememberFocus);
  }, []);
  useEffect(() => {
    if (!dialogKey) return;
    const panel = Array.from(document.querySelectorAll<HTMLElement>(".detail-sheet")).at(-1);
    if (!panel) return;
    const previous = lastOutsideFocus.current;
    const background = Array.from(document.querySelector(".plugin-shell")?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && !element.matches(".detail-backdrop, .toast"))
      .map((element) => ({ element, inert: element.inert }));
    background.forEach(({ element }) => { element.inert = true; });
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
      .filter((element) => !element.matches(":disabled, [hidden]") && element.getClientRects().length > 0);
    panel.tabIndex = -1;
    if (!panel.contains(document.activeElement)) (controls()[0] ?? panel).focus({ preventScroll: true });
    function trapTab(event: KeyboardEvent) {
      if (event.key !== "Tab" || event.isComposing) return;
      const items = controls();
      const first = items[0] ?? panel!;
      const last = items.at(-1) ?? panel!;
      if (!items.length || !panel!.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    document.addEventListener("keydown", trapTab, true);
    return () => {
      document.removeEventListener("keydown", trapTab, true);
      background.forEach(({ element, inert }) => { element.inert = inert; });
      const target = previous?.isConnected && !panel.contains(previous) ? previous : document.querySelector<HTMLInputElement>(".search-box input");
      target?.focus({ preventScroll: true });
    };
  }, [dialogKey]);
}
