// ebayClient.js
// Thin wrapper around eBay's OAuth token endpoint and Browse API.
//
// IMPORTANT LIMITATION (read this before you rely on the numbers):
// The Browse API only returns ACTIVE listings (things currently for sale),
// not completed/sold prices. eBay's sold-comp data lives in the
// Marketplace Insights API, which requires separate approval as an eBay
// partner (you apply for it inside the eBay Developer Program after your
// app already exists). Until/unless you get that approval, this tool
// estimates value from what sellers are ASKING, not what buyers are
// PAYING — treat the numbers as a ceiling-ish reference point, not a
// sold-price comp sheet like Card Ladder shows.

const EBAY_ENV = process.env.EBAY_ENV === "production" ? "production" : "sandbox";

const BASE_URLS = {
  production: {
    oauth: "https://api.ebay.com/identity/v1/oauth2/token",
    browse: "https://api.ebay.com/buy/browse/v1/item_summary/search",
  },
  sandbox: {
    oauth: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
    browse: "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search",
  },
};

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAppToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET. Copy .env.example to .env and fill in your eBay Developer credentials."
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const urls = BASE_URLS[EBAY_ENV];

  const res = await fetch(urls.oauth, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

// Builds a search keyword string from structured card fields.
// Structured fields produce far better matches than a free-text query,
// since card listing titles are fairly formulaic
// (e.g. "2023 Panini Prizm Erling Haaland Silver PSA 10").
function buildKeywords({ player, year, set, cardNumber, parallel, grade }) {
  return [year, set, parallel, player, cardNumber ? `#${cardNumber}` : null, grade]
    .filter(Boolean)
    .join(" ")
    .trim();
}

async function searchListings(params) {
  const token = await getAppToken();
  const urls = BASE_URLS[EBAY_ENV];
  const keywords = buildKeywords(params);

  if (!keywords) {
    throw new Error("At least a player name is required to search.");
  }

  const query = new URLSearchParams({
    q: keywords,
    limit: String(params.limit || 50),
  });

  // Trading card category on eBay (Sports Trading Cards). Verify/adjust
  // this in your own eBay account if results look off-category — category
  // IDs occasionally shift and are best confirmed via eBay's Taxonomy API
  // or by inspecting a real search URL on ebay.com.
  if (params.categoryId) {
    query.set("category_ids", params.categoryId);
  }

  const filters = [];
  if (params.condition) {
    filters.push(`conditions:{${params.condition}}`);
  }
  if (params.maxPrice) {
    filters.push(`price:[..${params.maxPrice}]`);
    filters.push("priceCurrency:USD");
  }
  if (filters.length) {
    query.set("filter", filters.join(","));
  }

  const res = await fetch(`${urls.browse}?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": params.marketplaceId || "EBAY_US",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay Browse search failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const items = (data.itemSummaries || []).map((item) => ({
    id: item.itemId,
    title: item.title,
    price: item.price ? Number(item.price.value) : null,
    currency: item.price ? item.price.currency : null,
    condition: item.condition || null,
    imageUrl: item.image ? item.image.imageUrl : null,
    url: item.itemWebUrl,
    seller: item.seller ? item.seller.username : null,
    listingType: item.buyingOptions ? item.buyingOptions.join(", ") : null,
  }));

  return { keywords, total: data.total || 0, items };
}

function summarizePrices(items) {
  const prices = items.map((i) => i.price).filter((p) => typeof p === "number" && p > 0).sort((a, b) => a - b);

  if (prices.length === 0) {
    return { count: 0, low: null, high: null, median: null, average: null };
  }

  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  return {
    count: prices.length,
    low: prices[0],
    high: prices[prices.length - 1],
    median: Math.round(median * 100) / 100,
    average: Math.round(average * 100) / 100,
  };
}

module.exports = { searchListings, summarizePrices, buildKeywords };
