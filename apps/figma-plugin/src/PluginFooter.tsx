import { ArrowUp, BookOpen, GitFork, Globe2 } from "lucide-react";
import logoUrl from "../community-assets/awalogo-logo.svg";

export function PluginFooter({ onPanelChange }: {
  onPanelChange: (panel: "contribute" | "changelog" | "trademarks") => void;
}) {
  return (
    <footer className="site-footer plugin-footer">
      <div className="plugin-footer-header">
        <div className="plugin-footer-brand"><img src={logoUrl} alt="" width="24" height="24" /><strong>awalogo</strong></div>
        <button className="plugin-footer-top" type="button" aria-label="Back to top" title="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}><ArrowUp size={16} aria-hidden="true" /></button>
      </div>
      <nav className="plugin-footer-links" aria-label="Catalog actions">
        <button type="button" aria-haspopup="dialog" onClick={() => onPanelChange("contribute")}>Submit a logo</button>
        <button type="button" aria-haspopup="dialog" onClick={() => onPanelChange("changelog")}>Changelog</button>
        <button type="button" aria-haspopup="dialog" onClick={() => onPanelChange("trademarks")}>Trademark policy</button>
      </nav>
      <nav className="plugin-footer-links plugin-footer-external" aria-label="Project resources">
        <a href="https://awalogo.com" target="_blank" rel="noreferrer"><Globe2 size={14} aria-hidden="true" />Website</a>
        <a href="https://github.com/adeyemimayokun/awalogo" target="_blank" rel="noreferrer"><GitFork size={14} aria-hidden="true" />GitHub</a>
        <a href="https://github.com/adeyemimayokun/awalogo/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer"><BookOpen size={14} aria-hidden="true" />Contribution guide</a>
      </nav>
      <p className="plugin-footer-note">MIT-licensed tooling. Logos belong to their respective owners. Check brand guidelines before use.</p>
    </footer>
  );
}
