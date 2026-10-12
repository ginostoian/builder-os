import type { ComponentType } from "react";
import BestQuotingSoftwareForBuildersUk from "./best-quoting-software-for-builders-uk";
import BuildertrendUk from "./buildertrend-uk";
import TradifyAlternativesForBuilders from "./tradify-alternatives-for-builders";

/** Article bodies by slug. Each slug must also be in BLOG_ARTICLES (src/lib/content/articles.ts). */
export const ARTICLE_BODIES: Record<string, ComponentType> = {
  "best-quoting-software-for-builders-uk": BestQuotingSoftwareForBuildersUk,
  "tradify-alternatives-for-builders": TradifyAlternativesForBuilders,
  "buildertrend-uk": BuildertrendUk,
};
