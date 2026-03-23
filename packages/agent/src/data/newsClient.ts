// ============================================================
// News & Sentiment Client
// Supports: Alpaca News API (free), NewsAPI, Alpha Vantage
// ============================================================
import axios from "axios";
import { NewsItem } from "@ai-trader/shared";
import { logger } from "../utils/logger";

export class NewsClient {
  private alpacaKey: string;
  private alpacaSecret: string;
  private newsApiKey?: string;

  constructor(
    alpacaKey: string,
    alpacaSecret: string,
    newsApiKey?: string
  ) {
    this.alpacaKey = alpacaKey;
    this.alpacaSecret = alpacaSecret;
    this.newsApiKey = newsApiKey;
  }

  // ----------------------------------------------------------
  // Alpaca News API (v1beta1) — free tier
  // ----------------------------------------------------------
  async getAlpacaNews(symbol: string, limit = 5): Promise<NewsItem[]> {
    try {
      const { data } = await axios.get(
        "https://data.alpaca.markets/v1beta1/news",
        {
          params: { symbols: symbol, limit, sort: "desc" },
          headers: {
            "APCA-API-KEY-ID": this.alpacaKey,
            "APCA-API-SECRET-KEY": this.alpacaSecret,
          },
          timeout: 8000,
        }
      );

      return (data.news ?? []).map((n: any): NewsItem => ({
        headline: n.headline ?? "",
        source: n.source ?? "alpaca-news",
        url: n.url,
        publishedAt: n.created_at ?? new Date().toISOString(),
        sentimentScore: null, // Alpaca doesn't provide sentiment score
        summary: n.summary,
      }));
    } catch (err: any) {
      logger.warn(`[News] Alpaca news failed for ${symbol}: ${err.message}`);
      return [];
    }
  }

  // ----------------------------------------------------------
  // NewsAPI.org (optional, needs NEWSAPI_KEY env var)
  // ----------------------------------------------------------
  async getNewsApiHeadlines(symbol: string, limit = 5): Promise<NewsItem[]> {
    if (!this.newsApiKey) return [];
    try {
      const { data } = await axios.get("https://newsapi.org/v2/everything", {
        params: {
          q: symbol,
          language: "en",
          sortBy: "publishedAt",
          pageSize: limit,
          apiKey: this.newsApiKey,
        },
        timeout: 8000,
      });

      return (data.articles ?? []).map((a: any): NewsItem => ({
        headline: a.title ?? "",
        source: a.source?.name ?? "newsapi",
        url: a.url,
        publishedAt: a.publishedAt ?? new Date().toISOString(),
        sentimentScore: null,
        summary: a.description,
      }));
    } catch (err: any) {
      logger.warn(`[News] NewsAPI failed for ${symbol}: ${err.message}`);
      return [];
    }
  }

  // ----------------------------------------------------------
  // Get news from best available source
  // ----------------------------------------------------------
  async getNews(symbol: string, limit = 5): Promise<NewsItem[]> {
    const news = await this.getAlpacaNews(symbol, limit);
    if (news.length > 0) return news;
    return this.getNewsApiHeadlines(symbol, limit);
  }

  // ----------------------------------------------------------
  // Simple rule-based sentiment score (-1 to 1)
  // (Replace with a proper NLP model if available)
  // ----------------------------------------------------------
  scoreSentiment(headline: string): number {
    const bullishWords = [
      "surge", "rally", "beat", "record", "upgrade", "buy", "bullish",
      "growth", "profit", "positive", "strong", "gains", "outperform",
    ];
    const bearishWords = [
      "drop", "fall", "miss", "downgrade", "sell", "bearish", "loss",
      "decline", "weak", "negative", "crash", "underperform", "cut",
    ];
    const text = headline.toLowerCase();
    let score = 0;
    bullishWords.forEach((w) => { if (text.includes(w)) score += 0.2; });
    bearishWords.forEach((w) => { if (text.includes(w)) score -= 0.2; });
    return Math.max(-1, Math.min(1, score));
  }

  async getNewsWithSentiment(symbol: string, limit = 5): Promise<NewsItem[]> {
    const news = await this.getNews(symbol, limit);
    return news.map((n) => ({
      ...n,
      sentimentScore: this.scoreSentiment(n.headline),
    }));
  }
}
