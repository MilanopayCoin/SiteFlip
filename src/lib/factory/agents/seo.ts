import {
  seoSchema,
  type BrandPlan,
  type ContentPack,
  type SeoPack,
} from "../schemas";
import { runStructuredAgent } from "./base";

export async function runSeoAgent(brand: BrandPlan, content: ContentPack) {
  return runStructuredAgent({
    system:
      "You are SITEFLIP SEOAgent. Return SEO pack JSON. Do not generate spam pages.",
    user: { brand, content },
    schema: seoSchema,
    heuristic: () => heuristicSeo(brand, content),
  });
}

function heuristicSeo(brand: BrandPlan, content: ContentPack): SeoPack {
  return {
    pageTitles: [
      { page: "home", title: content.seoMetadata.title },
      { page: "pricing", title: `Pricing · ${brand.brandName}` },
    ],
    metaDescriptions: [
      {
        page: "home",
        description: content.seoMetadata.description,
      },
    ],
    openGraph: {
      title: content.seoMetadata.title,
      description: content.seoMetadata.description,
      type: "website",
    },
    structuredDataTypes: ["Organization", "SoftwareApplication", "FAQPage"],
    sitemapPaths: ["/", "/pricing", "/login", "/signup"],
    robotsTxt: "User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n",
    canonicalStrategy: "Single canonical URL per page on primary domain",
    keywordStrategy: [
      brand.brandName.toLowerCase(),
      ...brand.brandVoice.map((v) => v.toLowerCase()),
      "MVP SaaS",
    ],
    labeledAssumptions: [
      "Keyword strategy is a hypothesis — validate with Search Console after launch",
      "No spam doorway pages generated",
    ],
  };
}
