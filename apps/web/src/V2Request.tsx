import { formerBrandName } from "./brand-history";
import V2Select from "./V2Select";
import { useV2Language } from "./V2Language";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Send } from "./icons";
import { logos } from "./v2-brand-data";
import { filterBrands } from "./brand-filters";

export default function V2Request({ embedded = false, onBrowse, onSelectBrand }: { embedded?: boolean; onBrowse?: () => void; onSelectBrand?: (slug: string) => void }) {
  const { t } = useV2Language();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ trackingUrl?: string | null } | null>(null);
  const [status, setStatus] = useState<{ brand_name: string; status: string } | null>(null);
  const [submissionId] = useState(() => crypto.randomUUID());
  const [trackingToken] = useState(() => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""));
  const token = new URLSearchParams(location.search).get("token");
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch(`/api/logo-requests?token=${encodeURIComponent(token)}`, { signal: controller.signal }).then(async (response) => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not load your request"); setStatus(body);
    }).catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Could not load your request"); });
    return () => controller.abort();
  }, [token]);
  const matches = name.trim().length > 1 ? filterBrands(logos, [], name).slice(0, 3) : [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/logo-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        submissionId, trackingToken, institutionName: name, officialWebsite: data.get("website"), email: data.get("email"), category: data.get("category"), logoAssetUrl: data.get("asset") || "", notifyWhenAvailable: data.get("notify") === "on", websiteConfirm: data.get("websiteConfirm") || ""
      }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Your request could not be saved"); setResult(body);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Your request could not be saved"); } finally { setBusy(false); }
  }
  return <section className={`v2-request${embedded ? " v2-request-embedded" : ""}`} aria-label={t("Brand request")}><a href="/v2" onClick={(event) => { if (onBrowse && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onBrowse(); } }}><ArrowLeft size={16} />{t("Back to the library")}</a><p className="v2-eyebrow">{t("GROW THE LIBRARY")}</p><h1>{token ? t("Your request") : result ? t("Request received") : t("Request a brand asset")}</h1>
    {error ? <p className="v2-error" role="alert">{t(error)}</p> : null}
    {token ? status ? <div className="v2-request-success"><h2>{status.brand_name}</h2><p>{t("Status:")} {t(status.status.replaceAll("-", " "))}</p></div> : !error ? <p role="status">{t("Loading request...")}</p> : null : result ? <div className="v2-request-success"><Check size={28} /><p>{t("We received your request for {name}.", { name })}</p>{result.trackingUrl ? <a href={result.trackingUrl}>{t("Track your request")}</a> : <p>{t("Your request has been delivered to the maintainers.")}</p>}<a href="/v2">{t("Return to the library")}</a></div> : <form onSubmit={submit}>
      <label>{t("Brand or company name")}<input name="name" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
      {matches.length ? <div className="v2-request-matches"><span>{t("Already in the library")}</span>{matches.map((logo) => <a key={logo.slug} href={`/v2?brand=${logo.slug}`} onClick={(event) => { if (onSelectBrand && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onSelectBrand(logo.slug); } }}>{logo.name}{formerBrandName(logo.slug) ? ` (${formerBrandName(logo.slug)})` : ""}</a>)}</div> : null}
      <label>{t("Official website")}<input name="website" type="url" required placeholder="https://company.com" /></label>
      <label>{t("Your email")}<input name="email" type="email" required maxLength={254} /></label>
      <label>{t("Company type")}<V2Select name="category">{["Bank", "Finance app", "Fintech", "Insurance", "Investment platform", "Payments", "Other"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</V2Select></label>
      <label>{t("Artwork link (optional)")}<input name="asset" type="url" placeholder="https://..." /></label>
      <label className="v2-check"><input name="notify" type="checkbox" defaultChecked />{t("Email me when it is available")}</label>
      <div className="v2-honeypot" aria-hidden="true"><input name="websiteConfirm" tabIndex={-1} autoComplete="off" /></div>
      <button className="v2-primary" disabled={busy}><Send size={16} />{busy ? t("Sending...") : t("Send request")}</button>
    </form>}
  </section>;
}
