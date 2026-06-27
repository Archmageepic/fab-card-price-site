# 資料與發佈規劃

## 第一階段架構

網站前端只負責搜尋、展示與暫存清單。價格資料集中在 `data/cards.json`，由 GitHub Actions 每天更新一次，更新後 Netlify 會重新部署靜態網站。

這個做法避免使用者瀏覽器直接抓第三方網站而遇到 CORS、登入、反爬或授權問題，也能讓頁面清楚顯示「最後更新時間」。

## 欄位

```json
{
  "id": "arc-159-unlimited",
  "name": "Command and Conquer",
  "cardNumber": "ARC159",
  "setName": "Arcane Rising",
  "pitch": "Generic Action",
  "notes": "CNC generic majestic",
  "prices": {
    "tokyoSell": 12800,
    "tokyoBuy": 7200,
    "fableSell": 11800,
    "fableBuy": 7600
  }
}
```

`tokyoBuy` 或 `fableBuy` 為 `null` 時，前端會顯示「暫無買取價格」。

## 資料同步策略

1. Card Vault 作為卡片基礎資料來源。
2. TOKYO FAB 與 Fable 可由後端排程抓取公開商品頁或買取表，整理成標準 JSON。
3. 每次同步保留 `lastUpdated` 與來源 URL，之後可以在 UI 顯示資料新鮮度。

## 每日更新流程

目前已加入 `.github/workflows/update-prices.yml`，排程為每天台北時間 04:17 執行一次。

流程：

1. GitHub Actions 執行 `npm run update:prices`。
2. `scripts/update-prices.mjs` 讀取各來源 feed/API。
3. 更新 `data/cards.json`。
4. 若資料有變更，提交一筆 commit。
5. Netlify 偵測 Git 變更後重新部署。

可設定的 GitHub Secrets：

- `TOKYO_FAB_SELL_FEED_URL`
- `TOKYO_FAB_BUY_FEED_URL`
- `FABLE_SELL_FEED_URL`
- `FABLE_BUY_FEED_URL`

每個 feed 可回傳陣列，欄位支援：

```json
[
  {
    "cardNumber": "ARC159",
    "name": "Command and Conquer",
    "price": 7600
  }
]
```

程式會優先用 `cardNumber` 對應，找不到時用 `name` 對應。

## 發佈路線

1. 本機 MVP：完成靜態前端和資料格式。
2. 靜態發佈：Netlify。
3. 自動更新：GitHub Actions 每日產生 `cards.json`。
4. 可靠性：新增價格更新紀錄、異常通知、來源頁解析測試。

## 需要決定

- 網站正式名稱與網域。
- 價格幣別是否全部換算成新台幣，或保留 JPY 原幣別。
- 買取總價是採「指定店家」還是「每張卡最佳買取價」。目前 MVP 同時顯示兩家與最佳總價。
- 是否需要帳號系統，讓暫存清單跨裝置保存。
