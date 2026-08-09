import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { hydrateMissingArticleImages } from "../src/lib/news/hydrateArticleImages";
import type { LottoMindNewsItem } from "../src/types/news";

type StaticArticle = Record<string, unknown> & {
  id?: string;
  title?: string;
  url?: string;
  canonicalUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceHomepage?: string;
  publishedAt?: string;
  snippet?: string;
  brief?: string;
  imageUrl?: string;
  publisherImageUrl?: string;
  categories?: string[];
};

const articleFile = resolve(process.cwd(), "..", "articles.json");
const publisherAssetDirectory = resolve(process.cwd(), "..", "assets", "news", "publishers");
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_CONCURRENCY = 5;
const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

function safeExtension(url: string, contentType: string): string | undefined {
  const fromType = IMAGE_EXTENSIONS.get(contentType.split(";")[0].trim().toLowerCase());
  if (fromType) return fromType;
  const fromPath = extname(new URL(url).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(fromPath)
    ? (fromPath === ".jpeg" ? ".jpg" : fromPath)
    : undefined;
}

function withoutUncachedExternalImage(article: StaticArticle, publisherImageUrl: string): StaticArticle {
  const nextArticle = { ...article, publisherImageUrl };
  if (/^https?:\/\//i.test(nextArticle.imageUrl || "")) {
    delete nextArticle.imageUrl;
  }
  return nextArticle;
}

async function cachePublisherImage(article: StaticArticle, index: number): Promise<StaticArticle> {
  const publisherImageUrl = article.publisherImageUrl
    || (/^https:\/\//i.test(article.imageUrl || "") ? article.imageUrl : undefined);
  if (!publisherImageUrl) return article;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(publisherImageUrl, {
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.2",
        "user-agent": "Mozilla/5.0 (compatible; LottoMindNewsHub/1.0; +https://robjasper2084.github.io/Jungle-Lotto/)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return withoutUncachedExternalImage(article, publisherImageUrl);
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_IMAGE_BYTES) return withoutUncachedExternalImage(article, publisherImageUrl);
    const extension = safeExtension(response.url || publisherImageUrl, response.headers.get("content-type") || "");
    if (!extension) return withoutUncachedExternalImage(article, publisherImageUrl);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      return withoutUncachedExternalImage(article, publisherImageUrl);
    }

    const articleId = article.id || `static-${index}`;
    const digest = createHash("sha256").update(publisherImageUrl).digest("hex").slice(0, 12);
    const safeId = articleId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || `article-${index}`;
    const filename = `${safeId}-${digest}${extension}`;
    await writeFile(resolve(publisherAssetDirectory, filename), bytes);
    return {
      ...article,
      publisherImageUrl,
      imageUrl: `../assets/news/publishers/${filename}`,
    };
  } catch {
    return withoutUncachedExternalImage(article, publisherImageUrl);
  } finally {
    clearTimeout(timeout);
  }
}
const articles = JSON.parse(await readFile(articleFile, "utf8")) as StaticArticle[];
const candidates = articles.map((article, index): LottoMindNewsItem => ({
  id: article.id || `static-${index}`,
  title: article.title || "Current source update",
  source: article.sourceName || "Attributed source",
  sourceUrl: article.sourceHomepage || article.sourceUrl || article.url || "https://example.com",
  articleUrl: article.url || article.canonicalUrl || article.sourceHomepage || "https://example.com",
  canonicalUrl: article.canonicalUrl || article.url || article.sourceHomepage || "https://example.com",
  category: "Lottery News" as const,
  publishedAt: article.publishedAt || new Date(0).toISOString(),
  displayDate: article.publishedAt || "Current",
  summary: article.brief || article.snippet || "Open the attributed source for details.",
  imageUrl: article.imageUrl,
  tags: article.categories || [],
  credibilityLabel: "Official",
  isOfficialSource: true,
  isFreeToRead: true,
  freeAccessNote: "Open the attributed publisher for the complete report.",
  fetchedAt: article.publishedAt || new Date(0).toISOString(),
}));

const hydrated = await hydrateMissingArticleImages(candidates);
const images = new Map(hydrated.filter((item) => item.imageUrl).map((item) => [item.id, item.imageUrl]));
const withDiscoveredImages = articles.map((article, index) => {
  const imageUrl = images.get(article.id || `static-${index}`);
  return imageUrl ? { ...article, imageUrl } : article;
});

await mkdir(publisherAssetDirectory, { recursive: true });
const next = [...withDiscoveredImages];
let cursor = 0;
const workers = Array.from({ length: Math.min(IMAGE_CONCURRENCY, next.length) }, async () => {
  while (cursor < next.length) {
    const index = cursor++;
    next[index] = await cachePublisherImage(next[index], index);
  }
});
await Promise.all(workers);

await writeFile(articleFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
const cachedCount = next.filter((article) => /^\.\.\/assets\/news\/publishers\//.test(article.imageUrl || "")).length;
console.log(`Hydrated ${images.size} source URLs and cached ${cachedCount} of ${articles.length} publisher images.`);
