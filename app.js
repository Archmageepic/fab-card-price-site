const state = {
  cards: [],
  query: "",
  list: loadList(),
  livePrices: new Map(),
};

const MAX_VISIBLE_RESULTS = 100;

const els = {
  searchInput: document.querySelector("#searchInput"),
  clearSearch: document.querySelector("#clearSearch"),
  resultsBody: document.querySelector("#resultsBody"),
  resultCount: document.querySelector("#resultCount"),
  dataDisclaimer: document.querySelector("#dataDisclaimer"),
  lastUpdated: document.querySelector("#lastUpdated"),
  listItems: document.querySelector("#listItems"),
  clearList: document.querySelector("#clearList"),
  tokyoTotal: document.querySelector("#tokyoTotal"),
  fableTotal: document.querySelector("#fableTotal"),
  bestTotal: document.querySelector("#bestTotal"),
  emptyTemplate: document.querySelector("#emptyTemplate"),
};

init();

async function init() {
  const response = await fetch("data/cards.json");
  const payload = await response.json();
  state.cards = payload.cards;
  els.lastUpdated.textContent = `${payload.updateMode === "daily" ? "每日更新" : "更新時間"} ${payload.lastUpdated}`;
  els.dataDisclaimer.textContent = payload.disclaimer || "價格會以資料匯入時的幣別顯示。";
  renderResults();
  renderList();

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    renderResults();
  });

  els.clearSearch.addEventListener("click", () => {
    state.query = "";
    els.searchInput.value = "";
    els.searchInput.focus();
    renderResults();
  });

  els.clearList.addEventListener("click", () => {
    state.list = [];
    saveList();
    renderResults();
    renderList();
  });
}

function renderResults() {
  const normalizedQuery = normalize(state.query);
  if (!normalizedQuery) {
    els.resultCount.textContent = `${state.cards.length} 張卡已載入`;
    els.resultsBody.replaceChildren();
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="8" class="empty-state">輸入卡片名稱或卡號開始查詢。完整卡庫已載入，搜尋結果最多先顯示 ${MAX_VISIBLE_RESULTS} 筆。</td>`;
    els.resultsBody.append(row);
    return;
  }

  const results = state.cards.filter((card) => {
    return [
      card.name,
      card.cardNumber,
      card.setName,
      card.notes,
    ].some((value) => normalize(value).includes(normalizedQuery));
  });
  const visibleResults = results.slice(0, MAX_VISIBLE_RESULTS);

  els.resultCount.textContent = results.length > MAX_VISIBLE_RESULTS
    ? `${results.length} 筆結果，顯示前 ${MAX_VISIBLE_RESULTS} 筆`
    : `${results.length} 筆結果`;
  els.resultsBody.replaceChildren();

  if (results.length === 0) {
    els.resultsBody.append(els.emptyTemplate.content.cloneNode(true));
    return;
  }

  const fragment = document.createDocumentFragment();
  visibleResults.forEach((card) => {
    const row = document.createElement("tr");
    const inList = state.list.some((item) => item.id === card.id);
    const livePrices = state.livePrices.get(card.id);
    const prices = livePrices ? { ...card.prices, ...livePrices } : card.prices;

    row.innerHTML = `
      <td>
        <div class="card-name">
          <strong>${escapeHtml(card.name)}</strong>
          <span>${escapeHtml(card.setName)} - ${escapeHtml(card.pitch || "N/A")}</span>
        </div>
      </td>
      <td>${escapeHtml(card.cardNumber)}</td>
      <td>${formatMoney(prices.tcgMid, "USD")}</td>
      <td>${formatMoney(prices.tokyoSell, "JPY")}</td>
      <td>${formatBuyPrice(prices.tokyoBuy)}</td>
      <td>${formatMoney(prices.fableSell, "JPY")}</td>
      <td>${formatBuyPrice(prices.fableBuy)}</td>
      <td><button class="add-button" data-id="${card.id}" ${inList ? "disabled" : ""}>${inList ? "已加入" : "加入"}</button></td>
    `;
    fragment.append(row);
  });

  els.resultsBody.append(fragment);
  loadLivePrices(visibleResults.slice(0, 10));
  els.resultsBody.querySelectorAll(".add-button:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => addToList(button.dataset.id));
  });
}

async function loadLivePrices(cards) {
  const missing = cards.filter((card) => !state.livePrices.has(card.id));
  if (missing.length === 0) return;

  await Promise.allSettled(missing.map(async (card) => {
    const params = new URLSearchParams({
      cardNumber: card.cardNumber,
      name: card.name,
    });
    const response = await fetch(`/api/prices?${params.toString()}`);
    if (!response.ok) return;
    const prices = await response.json();
    state.livePrices.set(card.id, {
      tcgMid: prices.tcgMid,
      tokyoSell: prices.tokyoSell,
      tokyoBuy: prices.tokyoBuy,
      fableSell: prices.fableSell,
      fableBuy: prices.fableBuy,
    });
  }));

  if (normalize(els.searchInput.value) === normalize(state.query)) {
    renderResults();
  }
}

function renderList() {
  els.listItems.replaceChildren();

  if (state.list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "list-empty";
    empty.textContent = "尚未加入卡片。";
    els.listItems.append(empty);
    updateTotals();
    return;
  }

  const fragment = document.createDocumentFragment();
  state.list.forEach((item) => {
    const card = state.cards.find((candidate) => candidate.id === item.id);
    if (!card) return;

    const node = document.createElement("article");
    node.className = "list-card";
    node.innerHTML = `
      <div>
        <h3>${escapeHtml(card.name)}</h3>
        <p>${escapeHtml(card.cardNumber)} - ${escapeHtml(card.setName)}</p>
      </div>
      <button class="remove-button" title="移除" aria-label="移除 ${escapeHtml(card.name)}" data-remove="${card.id}">×</button>
      <label class="quantity-row">
        <span>數量</span>
        <input type="number" min="1" max="999" step="1" value="${item.quantity}" data-quantity="${card.id}">
        <span>最佳單張 ${formatBuyPrice(Math.max(card.prices.tokyoBuy || 0, card.prices.fableBuy || 0))}</span>
      </label>
      <div class="line-prices">
        <span>TOKYO ${formatLineTotal(card.prices.tokyoBuy, item.quantity)}</span>
        <span>Fable ${formatLineTotal(card.prices.fableBuy, item.quantity)}</span>
      </div>
    `;
    fragment.append(node);
  });

  els.listItems.append(fragment);
  els.listItems.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => removeFromList(button.dataset.remove));
  });
  els.listItems.querySelectorAll("[data-quantity]").forEach((input) => {
    input.addEventListener("input", () => updateQuantity(input.dataset.quantity, input.value));
  });

  updateTotals();
}

function addToList(id) {
  state.list.push({ id, quantity: 1 });
  saveList();
  renderResults();
  renderList();
}

function removeFromList(id) {
  state.list = state.list.filter((item) => item.id !== id);
  saveList();
  renderResults();
  renderList();
}

function updateQuantity(id, value) {
  const quantity = Math.max(1, Number.parseInt(value || "1", 10));
  state.list = state.list.map((item) => item.id === id ? { ...item, quantity } : item);
  saveList();
  renderList();
}

function updateTotals() {
  const totals = state.list.reduce((sum, item) => {
    const card = state.cards.find((candidate) => candidate.id === item.id);
    if (!card) return sum;
    const quantity = item.quantity || 1;
    const tokyo = (card.prices.tokyoBuy || 0) * quantity;
    const fable = (card.prices.fableBuy || 0) * quantity;
    return {
      tokyo: sum.tokyo + tokyo,
      fable: sum.fable + fable,
      best: sum.best + Math.max(tokyo, fable),
    };
  }, { tokyo: 0, fable: 0, best: 0 });

  els.tokyoTotal.textContent = formatMoney(totals.tokyo, "JPY");
  els.fableTotal.textContent = formatMoney(totals.fable, "JPY");
  els.bestTotal.textContent = formatMoney(totals.best, "JPY");
}

function formatMoney(value, currency) {
  if (value === null || value === undefined) return "暫無價格";
  return new Intl.NumberFormat(currency === "JPY" ? "ja-JP" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(value);
}

function formatBuyPrice(value) {
  if (!value) return `<span class="no-price">暫無買取價格</span>`;
  return formatMoney(value, "JPY");
}

function formatLineTotal(value, quantity) {
  if (!value) return "暫無買取價格";
  return formatMoney(value * quantity, "JPY");
}

function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

function loadList() {
  try {
    return JSON.parse(localStorage.getItem("fab-price-list") || "[]");
  } catch {
    return [];
  }
}

function saveList() {
  localStorage.setItem("fab-price-list", JSON.stringify(state.list));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
