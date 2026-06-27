import { readFile, writeFile } from "node:fs/promises";

const DATA_FILE = new URL("../data/cards.json", import.meta.url);

const sourceFeeds = [
  {
    key: "tokyoSell",
    env: "TOKYO_FAB_SELL_FEED_URL",
    label: "TOKYO FAB sell price",
    currency: "JPY",
  },
  {
    key: "tokyoBuy",
    env: "TOKYO_FAB_BUY_FEED_URL",
    label: "TOKYO FAB buy price",
    currency: "JPY",
  },
  {
    key: "fableSell",
    env: "FABLE_SELL_FEED_URL",
    label: "Fable sell price",
    currency: "JPY",
  },
  {
    key: "fableBuy",
    env: "FABLE_BUY_FEED_URL",
    label: "Fable buy price",
    currency: "JPY",
  },
];

const payload = JSON.parse(await readFile(DATA_FILE, "utf8"));
const cards = payload.cards.map((card) => ({
  ...card,
  prices: {
    tokyoSell: card.prices?.tokyoSell ?? null,
    tokyoBuy: card.prices?.tokyoBuy ?? null,
    fableSell: card.prices?.fableSell ?? null,
    fableBuy: card.prices?.fableBuy ?? null,
  },
}));
const env = globalThis.process?.env ?? {};

const run = {
  updatedAt: taipeiTimestamp(),
  sources: [],
  warnings: [],
};

for (const feed of sourceFeeds) {
  const url = env[feed.env];
  if (!url) {
    run.warnings.push(`${feed.env} is not configured; kept existing ${feed.label} values.`);
    continue;
  }

  try {
    const prices = await fetchPriceFeed(url);
    applyPrices(cards, feed.key, prices);
    run.sources.push({
      label: feed.label,
      currency: feed.currency,
      updatedFrom: url,
    });
  } catch (error) {
    run.warnings.push(`${feed.label} update failed: ${error.message}`);
  }
}

const nextPayload = {
  ...payload,
  lastUpdated: run.updatedAt,
  updateMode: "daily",
  disclaimer: "價格每日自動更新一次；實際成交與買取價格以各店家網站公告為準。",
  updateLog: run,
  cards,
};

await writeFile(DATA_FILE, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");
console.log(`Updated ${cards.length} cards at ${run.updatedAt}`);
for (const warning of run.warnings) {
  console.warn(warning);
}

async function fetchPriceFeed(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "FAB price site updater/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.prices)) return data.prices;
  if (Array.isArray(data.cards)) return data.cards;
  throw new Error("feed must be an array or contain prices/cards array");
}

function applyPrices(cards, priceKey, rows) {
  const byCardNumber = new Map();
  const byName = new Map();

  for (const row of rows) {
    const value = normalizePrice(row.price ?? row.value ?? row[priceKey]);
    if (value === undefined) continue;

    if (row.cardNumber) byCardNumber.set(normalize(row.cardNumber), value);
    if (row.name) byName.set(normalize(row.name), value);
  }

  for (const card of cards) {
    const matched = byCardNumber.get(normalize(card.cardNumber)) ?? byName.get(normalize(card.name));
    if (matched !== undefined) {
      card.prices[priceKey] = matched;
    }
  }
}

function normalizePrice(value) {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const number = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : undefined;
}

function normalize(value = "") {
  return String(value).trim().toLowerCase();
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
