# FAB 單卡查價網站

這是第一版 GitHub Pages 靜態網站，用來查詢 Flesh and Blood 卡片與每日價格快照。

## 目前功能

- 透過卡名、卡號、系列名稱或備註搜尋卡片
- 顯示 TOKYO FAB 賣價、TOKYO FAB 買取價、Fable 賣價、Fable 買取價
- 沒有買取價時顯示「暫無買取價格」
- 將卡片加入暫存清單
- 為每張卡輸入數量
- 即時計算 TOKYO FAB、Fable 與最佳買取總價
- 暫存清單會保存在瀏覽器本機
- 首頁顯示價格快照更新時間

目前第一階段不包含 TCGplayer 價格欄位。

## 發佈方式

目前改採 GitHub Pages 發佈。網站是純靜態檔案，GitHub Actions 會把 `main` 分支中的 `index.html`、`styles.css`、`app.js`、`data/cards.json` 發佈成網站。

若 GitHub Pages 尚未啟用，請到 repository 的 Settings > Pages，將 Build and deployment 的 Source 設為 GitHub Actions。

## 卡表更新策略

Card Vault 卡表目前不自動更新。現有 `data/cards.json` 已包含完整卡表；等新產品上市或需要重新整理卡庫時，再手動執行卡表匯入需求。

匯入 Card Vault 英文卡表的指令保留如下，但不會在每日流程自動執行：

```bash
npm run import:cardvault
```

## 價格更新策略

價格採用每日快照，不在使用者查詢時即時抓取。

- 更新時間：每天台北時間 04:00
- 手動更新：可在 GitHub Actions 頁面執行 `Update card prices`
- 更新檔案：`data/cards.json`
- 失敗處理：若某個來源抓不到或未設定，保留上次成功價格，並在 `updateLog.warnings` 記錄原因

更新價格資料：

```bash
npm run update:prices
```

GitHub Secrets 可設定以下價格 feed/API：

- `TOKYO_FAB_SELL_FEED_URL`
- `TOKYO_FAB_BUY_FEED_URL`
- `FABLE_SELL_FEED_URL`
- `FABLE_BUY_FEED_URL`

若某個來源尚未設定，更新程式會保留現有價格。

## 資料來源

- Card Vault：卡片名稱、卡號、系列等基礎資料
- TOKYO FAB：賣價與買取價
- Fable：賣價與買取價

## 後續建議

下一步可以把 TOKYO FAB 與 Fable 的公開頁面解析器補進 `scripts/update-prices.mjs`，讓每日 04:00 的快照真正直接從來源網站整理價格。
