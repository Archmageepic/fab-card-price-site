# FAB 單卡查價網站

這是第一版可直接開啟的靜態網站 MVP，用來驗證查詢流程與暫存清單。

## 目前功能

- 透過卡名、卡號、系列名稱或備註搜尋卡片
- 顯示 TOKYO FAB 賣價、TOKYO FAB 買取價、Fable 賣價、Fable 買取價
- 沒有買取價時顯示「暫無買取價格」
- 將卡片加入暫存清單
- 為每張卡輸入數量
- 即時計算 TOKYO FAB、Fable 與最佳買取總價
- 暫存清單會保存在瀏覽器本機
- 價格資料標示每日更新時間

目前第一階段不包含 TCGplayer 價格欄位。

## 開啟方式

因為瀏覽器讀取 JSON 需要本機伺服器，請在此資料夾啟動任一靜態伺服器後開啟 `index.html`。

## Netlify 發佈

本專案已加入 `netlify.toml`，Netlify 設定如下：

- Build command：留空
- Publish directory：`.`
- 價格幣別：TOKYO FAB 與 Fable 保留 JPY

若用 Netlify 網頁版部署，可以直接把整個資料夾拖曳到 Netlify Deploys 頁面。若用 Git 連動，選擇此專案後保持上方設定即可。

## 每日更新

第一階段採用 GitHub Actions 每天台北時間 04:17 更新一次 `data/cards.json`。Netlify 需要用 GitHub repository 連動部署，資料更新 commit 後才會自動重新發布。

匯入 Card Vault 英文卡表：

```bash
npm run import:cardvault
```

更新價格資料：

```bash
npm run update:prices
```

GitHub Secrets 可設定以下價格 feed/API：

- `TOKYO_FAB_SELL_FEED_URL`
- `TOKYO_FAB_BUY_FEED_URL`
- `FABLE_SELL_FEED_URL`
- `FABLE_BUY_FEED_URL`

若某個來源尚未設定，更新程式會保留現有價格，並在 `data/cards.json` 的 `updateLog.warnings` 記錄原因。

## 資料結構

目前卡牌資料由 Card Vault 英文卡表匯入。正式價格可以讓後端排程把以下來源整理成相同格式：

- Card Vault：卡片名稱、卡號、系列等基礎資料
- TOKYO FAB：賣價與買取價
- Fable：賣價與買取價

## 正式發佈建議

第一階段可用靜態網站加上每日更新的 `cards.json` 發佈到 Netlify。第二階段再補價格來源解析、管理頁、價格更新紀錄與錯誤監控。
