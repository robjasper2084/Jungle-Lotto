import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
  categories?: string[];
};

const articleFile = resolve(process.cwd(), "..", "articles.json");
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
const next = articles.map((article, index) => {
  const imageUrl = images.get(article.id || `static-${index}`);
  return imageUrl ? { ...article, imageUrl } : article;
});

await writeFile(articleFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
console.log(`Hydrated ${images.size} of ${articles.length} static news articles with attributed source imagery.`);
