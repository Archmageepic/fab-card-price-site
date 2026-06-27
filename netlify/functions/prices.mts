type PriceResult = {
  cardNumber: string;
  tcgMid: number | null;
  tokyoSell: number | null;
  tokyoBuy: number | null;
  fableSell: number | null;
  fableBuy: number | null;
  updatedAt: string;
  warnings: string[];
};

const PRICE_CACHE_SECONDS = 60 * 30;

export default async (req: Request) => {
  const url = new URL(req.url);
  const cardNumber = normalizeInput(url.searchParams.get("cardNumber"));
  const name = normalizeInput(url.searchParams.get("name"));

  if (!cardNumber || !name) {
    return json({ error: "cardNumber and name are required" }, 400);
  }

  const result: PriceResult = {
    cardNumber,
    tcgMid: null,
    tokyoSell: null,
    tokyoBuy: null,
    fableSell: null,
    fableBuy: null,
    updatedAt: taipeiTimestamp(),
    warnings: ["TCGplayer Mid Price requires an authorized API/feed and is not connected yet."],
  };

  const [tokyoSell, tokyoBuy, fableSell, fableBuy] = await Promise.allSettled([
    fetchTokyoFabPrice("https://www.tokyofab.com", cardNumber, "sell"),
    fetchTokyoFabPrice("https://www.tokyofab-buy.com", cardNumber, "buy"),
    fetchFableSellPrice(cardNumber, name),
    fetchFableBuyPrice(cardNumber, name),
  ]);

  result.tokyoSell = valueOrNull(tokyoSell, result.warnings, "TOKYO FAB sell price");
  result.tokyoBuy = valueOrNull(tokyoBuy, result.warnings, "TOKYO FAB buy price");
  result.fableSell = valueOrNull(fableSell, result.warnings, "Fable sell price");
  result.fableBuy = valueOrNull(fableBuy, result.warnings, "Fable buy price");

  return json(result, 200, {
    "Cache-Control": `public, max-age=${PRICE_CACHE_SECONDS}`,
  });
};

export const config = {
  path: "/api/prices",
};

async function fetchTokyoFabPrice(origin: string, cardNumber: string, mode: "sell" | "buy") {
  const html = await fetchText(`${origin}/view/search?search_keyword=${encodeURIComponent(cardNumber)}`);
  const cards = extractBlocks(html, "product-card");
  const prices = cards
    .filter((block) => block.includes(cardNumber))
    .map((block) => extractPrice(block))
    .filter((price): price is number => price !== null);

  if (prices.length === 0) return null;
  return mode === "buy" ? Math.max(...prices) : Math.min(...prices);
}

async function fetchFableSellPrice(cardNumber: string, name: string) {
  const directHtml = await fetchText(`https://www.fable-fab.com/view/search?search_keyword=${encodeURIComponent(cardNumber)}`);
  let prices = extractFableItemPrices(directHtml, cardNumber);

  if (prices.length === 0) {
    const nameHtml = await fetchText(`https://www.fable-fab.com/view/search?search_keyword=${encodeURIComponent(name)}`);
    prices = extractFableItemPrices(nameHtml, cardNumber);
  }

  if (prices.length === 0) return null;
  return Math.min(...prices);
}

async function fetchFableBuyPrice(cardNumber: string, name: string) {
  const html = await fetchText("https://www.fable-fab.com/view/page/buylist");
  const escapedNumber = escapeRegExp(cardNumber);
  const escapedName = escapeRegExp(name);
  const rowPattern = new RegExp(`<tr[\\s\\S]*?(?:${escapedNumber}|${escapedName})[\\s\\S]*?</tr>`, "gi");
  const rows = [...html.matchAll(rowPattern)].map((match) => match[0]);
  const prices = rows
    .map((row) => extractPrice(row))
    .filter((price): price is number => price !== null);

  if (prices.length === 0) return null;
  return Math.max(...prices);
}

function extractFableItemPrices(html: string, cardNumber: string) {
  return extractBlocks(html, "item-card")
    .filter((block) => block.includes(cardNumber))
    .map((block) => extractPrice(block))
    .filter((price): price is number => price !== null);
}

function extractBlocks(html: string, className: string) {
  const pattern = new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][\\s\\S]*?(?=<[^>]+class=["'][^"']*${className}[^"']*["']|</ul>|</main>|$)`, "gi");
  return [...html.matchAll(pattern)].map((match) => match[0]);
}

function extractPrice(html: string) {
  const dataPrice = html.match(/data-product-price=["']([0-9,]+)["']/i)?.[1];
  if (dataPrice) return toNumber(dataPrice);

  const yen = html.match(/[￥¥]\s*([0-9,]+)/)?.[1];
  if (yen) return toNumber(yen);

  const priceClass = html.match(/class=["'][^"']*price[^"']*["'][^>]*>\s*([0-9,]+)/i)?.[1];
  if (priceClass) return toNumber(priceClass);

  return null;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml",
      "user-agent": "FAB card price lookup/0.1",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response.text();
}

function valueOrNull(result: PromiseSettledResult<number | null>, warnings: string[], label: string) {
  if (result.status === "fulfilled") return result.value;
  warnings.push(`${label} lookup failed: ${result.reason instanceof Error ? result.reason.message : "unknown error"}`);
  return null;
}

function toNumber(value: string) {
  const number = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function normalizeInput(value: string | null) {
  return (value || "").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function taipeiTimestamp() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} CST`;
}
