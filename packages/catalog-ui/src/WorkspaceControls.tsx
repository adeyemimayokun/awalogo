import type { ButtonHTMLAttributes, SelectHTMLAttributes } from "react";

/** V2 native select: retains browser keyboard support and multiple selection. */
export function WorkspaceSelect({ className, multiple, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className={"v2-select workspace-select" + (multiple ? " is-multiple" : "")}>
    <select {...props} multiple={multiple} className={className}/>
    {!multiple && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>}
  </span>;
}

export function WorkspaceButton({ className = "", variant = "primary", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return <button {...props} type={type} className={"workspace-button workspace-button--" + variant + " " + className}/>;
}
