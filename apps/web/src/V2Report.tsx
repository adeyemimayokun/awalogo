import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, Send } from "lucide-react";
import V2Select from "./V2Select";
import { useV2Language } from "./V2Language";

type Props = { name: string; slug: string; variation: string; versionName: string; format: string; onBack: () => void };
export default function V2Report({ name, slug, variation, versionName, format, onBack }: Props) {
  const { t } = useV2Language();
  const [reason, setReason] = useState("Outdated logo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submissionId] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/logo-requests?view=report", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ submissionId, slug, variation, format, reason, note: fields.get("note"), officialSource: fields.get("officialSource"), websiteConfirm: fields.get("websiteConfirm") || "" })
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.ok !== true) throw new Error(body?.error ?? "Your report could not be delivered. Please try again shortly.");
      setSent(true);
    } catch (caught) { setError(caught instanceof Error && caught.name !== "TimeoutError" ? caught.message : "The request timed out. Your details are still here; please try again."); }
    finally { setBusy(false); }
  }
  return <section className="v2-report">
    <button className="v2-report-back" onClick={onBack}><ArrowLeft size={15} />{t("Back to logo")}</button>
    <p className="v2-eyebrow">{t("ASSET FEEDBACK")}</p><h2>{sent ? t("Report received") : t("Report logo")}</h2>
    <p className="v2-report-intro">{sent ? t("Thank you for helping improve {name}'s artwork. The maintainers will review your report.", { name }) : t("Let us know if {name}'s logo is outdated, has the wrong color, or is not displaying correctly.", { name })}</p>
    <div className="v2-report-context"><strong>{name}</strong><span>{t(versionName)} / {format.toUpperCase()}</span></div>
    {sent ? <div className="v2-report-success" role="status"><Check size={20} /><p>{t("Sent to the awalogo maintainers.")}</p><button className="v2-primary" onClick={onBack}>{t("Back to logo")}</button></div> : <form onSubmit={submit}>
      <label>{t("Reason")}<V2Select value={reason} onChange={(event) => setReason(event.target.value)} name="reason">{["Outdated logo", "Wrong color", "Wrong asset", "Broken download", "Other"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</V2Select></label>
      <label>{t("Note")} {reason === "Other" ? t("(required)") : t("(optional)")}<textarea name="note" rows={4} maxLength={2000} required={reason === "Other"} minLength={reason === "Other" ? 10 : undefined} placeholder={t("Briefly describe what needs fixing...")} /></label>
      <label>{t("Official source (optional)")}<input type="url" name="officialSource" maxLength={2048} placeholder="https://company.com/brand-guidelines" /><small>{t("A company website or official brand guide helps us verify the correction.")}</small></label>
      <div className="v2-honeypot" aria-hidden="true"><input name="websiteConfirm" tabIndex={-1} autoComplete="off" /></div>
      {error ? <p className="v2-error" role="alert">{t(error)}</p> : null}
      <div className="v2-actions"><button type="button" onClick={onBack}>{t("Cancel")}</button><button className="v2-primary" disabled={busy} type="submit"><Send size={16} />{busy ? t("Sending...") : t("Submit report")}</button></div>
    </form>}
  </section>;
}
