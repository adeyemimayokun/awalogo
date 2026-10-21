import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "./icons";

export default function V2Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="v2-select">
    <select {...props} />
    <ChevronDown size={16} aria-hidden="true" />
  </span>;
}
