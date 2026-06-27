import { readFile, writeFile } from "node:fs/promises";

const API_BASE = "https://api.cardvault.fabtcg.com/carddb/api/v1/";
const DATA_FILE = new URL("../data/cards.json", import.meta.url);

const currentPayload = JSON.parse(await readFile(DATA_FILE, "utf8"));
const existingPrices = new Map(
  currentPayload.cards.map((card) => [card.cardNumber, card.prices])
);

const products = await fetchEnglishProducts();
const cards = [];
const seen = new Set();

for (const product of products) {
  const productCards = await fetchJson(`${API_BASE}product-cards/${product.slug}/`);
  for (const card of productCards.cards ?? []) {
    if (!card.print_id || seen.has(card.print_id)) continue;
    seen.add(card.print_id);
    cards.push(toSiteCard(card, productCards.product_name || product.product_name));
  }
}

cards.sort((a, b) => a.cardNumber.localeCompare(b.cardNumber));

const timestamp = taipeiTimestamp();
const nextPayload = {
  ...currentPayload,
  lastUpdated: timestamp,
  updateMode: "daily",
  disclaimer: "卡片資料來自 Card Vault；價格每日自動更新一次。實際成交與買取價格以各店家網站公告為準。",
  updateLog: {
    updatedAt: timestamp,
    sources: [
      {
        label: "Card Vault card database",
        updatedFrom: `${API_BASE}product-groups-products/`,
      },
    ],
    warnings: [
      "Card list imported from Card Vault English products. Price feeds are not configured yet, so missing prices are shown as unavailable.",
    ],
  },
  cards,
};

await writeFile(DATA_FILE, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");
console.log(`Imported ${cards.length} Card Vault prints from ${products.length} English products.`);

async function fetchEnglishProducts() {
  const products = [];
  let url = `${API_BASE}product-groups-products/`;

  while (url) {
    const page = await fetchJson(url);
    for (const group of page.results ?? []) {
      const englishProduct = (group.products ?? []).find((product) => product.printed_language === "en" && product.slug);
      if (englishProduct) {
        products.push(englishProduct);
      }
    }
    url = page.next;
  }

  return products;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "FAB price site card importer/0.1",
    },
  });
  if (!response.ok) {
    throw new Error(`Card Vault request failed: ${response.status} ${url}`);
  }
  return response.json();
}

function toSiteCard(card, productName) {
  const existing = existingPrices.get(card.print_id) ?? {};
  const prices = {
    tokyoSell: existing.tokyoSell ?? null,
    tokyoBuy: existing.tokyoBuy ?? null,
    fableSell: existing.fableSell ?? null,
    fableBuy: existing.fableBuy ?? null,
  };

  return {
    id: card.print_id.toLowerCase(),
    name: card.printed_name || card.card_id || card.print_id,
    cardNumber: card.print_id,
    setName: productName || "Unknown Product",
    pitch: describePitch(card.printed_pitch, card.printed_typebox),
    notes: card.printed_typebox || "",
    prices,
  };
}

function describePitch(pitch, typebox) {
  const parts = [];
  if (pitch !== null && pitch !== undefined && pitch !== "") {
    parts.push(`Pitch ${pitch}`);
  }
  if (typebox) {
    parts.push(typebox);
  }
  return parts.join(" - ") || "N/A";
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

  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} CST`;
}
