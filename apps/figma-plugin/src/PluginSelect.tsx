import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

export function PluginSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="plugin-select"><select {...props} /><ChevronDown size={16} aria-hidden="true" /></span>;
}
