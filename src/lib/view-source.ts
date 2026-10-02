export type ViewSource = "GOOGLE" | "INSTAGRAM" | "NAVER" | "OTHER" | "UNKNOWN";

export function classifyViewSource(referrer: string, utmSource: string | null, siteHost: string): ViewSource | null {
  const source = utmSource?.toLowerCase();
  if (source) {
    if (source === "google" || source === "googleads" || source === "google-ads") return "GOOGLE";
    if (source === "instagram" || source === "ig") return "INSTAGRAM";
    if (source === "naver") return "NAVER";
    return "OTHER";
  }

  if (!referrer) return null;

  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.replace(/^www\./, "") === siteHost.toLowerCase().replace(/^www\./, "")) return null;
    if (/(^|\.)google\.(com|co\.[a-z]{2}|[a-z]{2,3})$/.test(host)) return "GOOGLE";
    if (/(^|\.)instagram\.com$/.test(host)) return "INSTAGRAM";
    if (/(^|\.)naver\.com$/.test(host)) return "NAVER";
    return "OTHER";
  } catch {
    return null;
  }
}
