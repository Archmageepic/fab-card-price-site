# 資料與發佈規劃

## 第一階段架構

網站前端只負責搜尋、展示與暫存清單。價格資料集中在 `data/cards.json`，由 GitHub Actions 每天台北時間 04:00 更新一次。網站改由 GitHub Pages 發佈。

這個做法避免使用者瀏覽器直接抓第三方網站而遇到 CORS、登入、反爬或授權問題，也能讓頁面清楚顯示「價格快照時間」。

## 卡表策略

Card Vault 卡表短期不自動更新。現有 `data/cards.json` 已包含完整卡表；等新產品上市或需要重新整理卡庫時，再手動執行卡表匯入。

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

1. Card Vault 只在需要時手動更新卡表。
2. TOKYO FAB 與 Fable 價格每天台北時間 04:00 更新一次。
3. 每次同步保留 `lastUpdated`、`updateLog.updatedAt`、來源 URL 與警告訊息。
4. 若某來源抓取失敗，不清空現有價格，保留上次成功價格，並寫入 `updateLog.warnings`。

## 每日價格更新流程

`.github/workflows/update-prices.yml` 排程為每天台北時間 04:00 執行一次。

流程：

1. GitHub Actions 執行 `npm run update:prices`。
2. `scripts/update-prices.mjs` 讀取各來源 feed/API。
3. 更新 `data/cards.json` 的價格與快照時間。
4. 若資料有變更，提交一筆 commit。
5. GitHub Pages 部署 workflow 偵測 `data/cards.json` 變更後重新發布網站。

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

1. 靜態前端：GitHub Pages。
2. 價格快照：GitHub Actions 每日 04:00 更新 `cards.json`。
3. 卡表更新：新產品上市時再手動匯入 Card Vault。
4. 可靠性：新增價格來源解析測試、異常通知與更新紀錄檢查。

## 需要決定

- 網站正式名稱與網域。
- 價格幣別是否全部換算成新台幣，或保留 JPY 原幣別。
- 買取總價是採「指定店家」還是「每張卡最佳買取價」。目前 MVP 同時顯示兩家與最佳總價。
- 是否需要管理者頁面，提供更方便的手動更新入口。
