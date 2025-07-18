// index.js - Cloud Run Node.js 代理服務

const express = require('express');
const fetch = require('node-fetch'); // For making HTTP requests
const cors = require('cors'); // For handling CORS
const app = express();

// Cloud Run 會將埠號注入到 PORT 環境變數中
// 應用程式必須監聽這個埠號
const port = process.env.PORT || 8080;

console.log(`[STARTUP] 應用程式正在啟動...`);
console.log(`[STARTUP] 監聽埠號設定為: ${port}`);

// 替換為您的 Google Apps Script 網路應用程式 URL
const APPS_SCRIPT_WEB_APP_URL = '您的AppsScript網路應用程式URL'; // 例如: 'https://script.google.com/macros/s/AKfycbz.../exec'
console.log(`[STARTUP] Apps Script 後端 URL: ${APPS_SCRIPT_WEB_APP_URL}`);

// 配置 CORS
// 允許來自所有來源的請求。在生產環境中，請將 'origin' 限制為您的前端網域。
app.use(cors({
  origin: '*', // 允許所有來源。對於本地測試，這會解決問題。
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
console.log(`[STARTUP] CORS 中間件已配置。允許所有來源。`);

// Express 中間件，用於解析 JSON 請求主體
app.use(express.json());
console.log(`[STARTUP] JSON 解析中間件已配置。`);

// 處理 POST 請求的路由
app.post('/proxy', async (req, res) => {
  console.log(`[REQUEST] 收到來自前端的請求: ${req.method} ${req.originalUrl}`);
  try {
    // 獲取前端發送的數據
    const { dialog_text, context } = req.body;
    console.log(`[REQUEST] 請求主體: dialog_text=${dialog_text ? dialog_text.substring(0, 50) + '...' : 'N/A'}, context=${context}`);

    if (!dialog_text) {
      console.warn(`[ERROR] 缺少 dialog_text，返回 400 錯誤。`);
      return res.status(400).json({ status: 'error', detail: 'Missing dialog_text in request body.' });
    }

    // 將請求轉發到 Apps Script
    console.log(`[PROXY] 正在轉發請求到 Apps Script: ${APPS_SCRIPT_WEB_APP_URL}`);
    const appsScriptResponse = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dialog_text, context })
    });
    console.log(`[PROXY] 收到 Apps Script 響應，狀態碼: ${appsScriptResponse.status}`);

    // 檢查 Apps Script 的響應狀態
    if (!appsScriptResponse.ok) {
      const errorText = await appsScriptResponse.text();
      console.error(`[ERROR] Apps Script 返回錯誤狀態碼: ${appsScriptResponse.status}, 錯誤內容: ${errorText}`);
      return res.status(appsScriptResponse.status).json({
        status: 'error',
        detail: `Apps Script 錯誤: ${errorText}`
      });
    }

    // 將 Apps Script 的響應轉發回前端
    const appsScriptData = await appsScriptResponse.json();
    console.log(`[PROXY] 成功從 Apps Script 獲取數據。`);
    res.status(200).json(appsScriptData);

  } catch (error) {
    console.error(`[FATAL ERROR] 代理服務器處理請求時發生錯誤: ${error.message}`, error);
    res.status(500).json({ status: 'error', detail: `代理服務器內部錯誤: ${error.message}` });
  }
});

// 啟動服務器並監聽指定埠號
app.listen(port, () => {
  console.log(`[STARTUP] Proxy server 成功啟動並監聽埠號 ${port}`);
});

// 捕獲未處理的 Promise 拒絕和未捕獲的異常，以防止應用程式崩潰
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION] 未處理的 Promise 拒絕:', reason);
  // 應用程式可能處於不穩定狀態，可以選擇退出或記錄更多信息
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION] 未捕獲的異常:', err);
  // 這是一個嚴重的錯誤，通常表示應用程式需要重新啟動
  process.exit(1); // 退出應用程式，讓 Cloud Run 重新啟動容器
});
