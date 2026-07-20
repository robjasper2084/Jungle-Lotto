import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const MAX_ITEMS = 250;

const allowedOrigins = new Set([
  "http://127.0.0.1:8142",
  "http://localhost:8142",
  "https://robjasper2084.github.io"
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "access-control-allow-origin": allowedOrigins.has(origin) ? origin : "https://robjasper2084.github.io",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

function json(req: Request, body: unknown, status = 200) {
  const isAuthenticated = Boolean(req.headers.get("authorization"));
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "content-type": "application/json; charset=utf-8",
      "cache-control": status === 200
        ? (isAuthenticated ? "private, no-store" : "public, max-age=60, stale-while-revalidate=300")
        : "no-store"
    }
  });
}

function clean(value: string | null, max = 80) {
  return (value || "").trim().slice(0, max);
}

function deriveCategory(categories: string[], copy: string, trust: string) {
  const first = categories[0]?.toLowerCase() || "";
  const haystack = `${categories.join(" ")} ${copy}`.toLowerCase();
  if (first.includes("paranormal")) return "Paranormal";
  if (/official uap|government uap|pentagon|aaaro/.test(haystack)) return "Official UAP";
  if (/ufo|\buap\b/.test(haystack)) return "UFO / UAP";
  if (/unexplained/.test(haystack)) return "The Unexplained";
  if (/space|astronomy|cosmos|nasa/.test(haystack)) return "Space Mystery";
  if (/numerology/.test(haystack)) return "Numerology";
  if (/horoscope|astrology/.test(haystack)) return "Horoscopes";
  if (/pick\s*[34]/.test(haystack)) return "Pick 3 / Pick 4";
  if (/winner|wins?\b|claim(?:ed|s)?\b/.test(haystack)) return "Lottery Winners";
  if (/jackpot|powerball|mega millions/.test(haystack)) return "Jackpot Watch";
  if (/ticket|scam|fraud|sign your/.test(haystack)) return "Ticket Safety";
  return trust === "official-lottery" ? "State Lottery" : "Lottery News";
}

const categoryFilters: Record<string, string[]> = {
  lottery: ["Lottery News", "Lottery Winners", "Jackpot Watch", "Powerball / Mega Millions", "Pick 3 / Pick 4", "State Lottery", "Ticket Safety", "Lottery Law"],
  winners: ["Lottery Winners"],
  jackpots: ["Jackpot Watch", "Powerball / Mega Millions"],
  "pick-3-pick-4": ["Pick 3 / Pick 4"],
  "ticket-safety": ["Ticket Safety"],
  "ufo-uap": ["UFO / UAP", "Official UAP"],
  "official-uap": ["Official UAP"],
  unexplained: ["The Unexplained", "Paranormal"],
  paranormal: ["Paranormal"],
  "space-mystery": ["Space Mystery"],
  numerology: ["Numerology"],
  horoscopes: ["Horoscopes"]
};

function normalize(row: Record<string, unknown>) {
  const categories = Array.isArray(row.categories) ? row.categories.map(String) : [];
  const title = String(row.title || "Untitled signal");
  const sourceName = String(row.source_name || "Attributed source");
  const articleUrl = String(row.url || row.source_url || "#");
  const sourceUrl = String(row.source_url || row.source_homepage || articleUrl);
  const summary = String(row.brief || row.snippet || "Open the original source for the complete report.");
  const trust = String(row.source_trust_level || "established-reporting");
  const category = deriveCategory(categories, `${title} ${summary}`, trust);
  const publishedAt = row.published_at ? String(row.published_at) : null;
  const official = row.source_trust_level === "official-lottery" || row.source_type === "official";
  const free = row.is_premium !== true;
  return {
    id: String(row.external_id || row.id),
    externalId: String(row.external_id || row.id),
    title,
    url: articleUrl,
    articleUrl,
    canonicalUrl: String(row.canonical_url || articleUrl),
    source: sourceName,
    sourceName,
    sourceUrl,
    sourceHomepage: String(row.source_homepage || sourceUrl),
    sourceTrustLevel: trust,
    sourceType: String(row.source_type || "publisher"),
    categories,
    category,
    publishedAt,
    displayDate: publishedAt,
    snippet: String(row.snippet || summary),
    brief: summary,
    summary,
    verificationLanguage: String(row.verification_language || "Review the original source and verify claims with the relevant official operator."),
    officialVerificationLanguage: String(row.official_verification_language || ""),
    importMethod: String(row.import_method || "supabase-news"),
    automated: row.automated === true,
    isAutomated: row.automated === true,
    generatedAt: row.generated_at ? String(row.generated_at) : null,
    tags: categories,
    credibilityLabel: official ? "Official source" : "Source attributed",
    isOfficialSource: official,
    isFreeToRead: free,
    freeAccessNote: free ? "This source is available without a LottoMind membership." : "Active LottoMind membership required.",
    estimatedReadMinutes: 1,
    imageUrl: null
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "GET") return json(req, { error: "Method not allowed" }, 405);

  const requestUrl = new URL(req.url);
  const route = requestUrl.pathname.replace(/^\/+|\/+$/g, "");
  if (route && !route.endsWith("lottomind-news") && !route.endsWith("lottomind-news/news")) {
    return json(req, { error: "Not found" }, 404);
  }

  const requestedPage = Number.parseInt(requestUrl.searchParams.get("page") || "1", 10);
  const requestedLimit = Number.parseInt(requestUrl.searchParams.get("limit") || "24", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(60, Math.max(1, requestedLimit)) : 24;
  const query = clean(requestUrl.searchParams.get("q") || requestUrl.searchParams.get("query"));
  const category = clean(requestUrl.searchParams.get("category")).toLowerCase();

  const authorization = req.headers.get("authorization");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: authorization ? { Authorization: authorization } : {} },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await client
    .from("news_articles")
    .select("id, external_id, title, url, canonical_url, source_name, source_homepage, source_trust_level, source_type, source_url, categories, published_at, snippet, brief, verification_language, official_verification_language, import_method, automated, generated_at, is_premium")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(MAX_ITEMS);

  if (error) return json(req, { error: "News feed unavailable", detail: error.message }, 503);

  let items = (data || []).map((row) => normalize(row as Record<string, unknown>));
  if (category && category !== "all") {
    const accepted = categoryFilters[category] || [category];
    items = items.filter((item) => accepted.includes(item.category));
  }
  if (query) {
    const needle = query.toLowerCase();
    items = items.filter((item) => `${item.title} ${item.summary} ${item.sourceName} ${item.categories.join(" ")}`.toLowerCase().includes(needle));
  }

  const total = items.length;
  const offset = (page - 1) * limit;
  const pageItems = items.slice(offset, offset + limit);
  return json(req, {
    items: pageItems,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    fetchedAt: new Date().toISOString(),
    cached: false,
    retentionDays: 120,
    sourceStatuses: [...new Set(pageItems.map((item) => item.sourceName))].map((source) => ({ source, status: "online" }))
  });
});
