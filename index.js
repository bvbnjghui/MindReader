const express = require('express');
const fetch = require('node-fetch'); // For making HTTP requests
const cors = require('cors'); // For handling CORS
const app = express();
const port = process.env.PORT || 8080; // Cloud Run will set the PORT environment variable

// 替換為您的 Google Apps Script 網路應用程式 URL
const APPS_SCRIPT_WEB_APP_URL = '您的AppsScript網路應用程式URL'; // 例如: 'https://script.google.com/macros/s/AKfycbz.../exec'

// 配置 CORS
// 允許來自所有來源的請求。在生產環境中，請將 'origin' 限制為您的前端網域。
app.use(cors({
  origin: '*', // 允許所有來源。對於本地測試，這會解決問題。
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Express 中間件，用於解析 JSON 請求主體
app.use(express.json());

// 處理 POST 請求的路由
app.post('/proxy', async (req, res) => {
  try {
    // 獲取前端發送的數據
    const { dialog_text, context } = req.body;

    if (!dialog_text) {
      return res.status(400).json({ status: 'error', detail: 'Missing dialog_text in request body.' });
    }

    // 將請求轉發到 Apps Script
    const appsScriptResponse = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 注意：這裡不需要設置 Origin 標頭，因為這是伺服器到伺服器的請求
      },
      body: JSON.stringify({ dialog_text, context })
    });

    // 檢查 Apps Script 的響應狀態
    if (!appsScriptResponse.ok) {
      const errorText = await appsScriptResponse.text();
      console.error('Apps Script 返回錯誤:', appsScriptResponse.status, errorText);
      return res.status(appsScriptResponse.status).json({
        status: 'error',
        detail: `Apps Script 錯誤: ${errorText}`
      });
    }

    // 將 Apps Script 的響應轉發回前端
    const appsScriptData = await appsScriptResponse.json();
    res.status(200).json(appsScriptData);

  } catch (error) {
    console.error('代理服務器錯誤:', error);
    res.status(500).json({ status: 'error', detail: `代理服務器內部錯誤: ${error.message}` });
  }
});

// 處理 OPTIONS 請求 (CORS 預檢請求)
// `cors()` 中間件會自動處理 OPTIONS 請求，所以這裡不需要額外定義。
// 但如果沒有使用 `cors` 中間件，則需要這樣處理：
/*
app.options('/proxy', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*'); // 允許所有來源
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).send(); // 204 No Content
});
*/

// 啟動服務器
app.listen(port, () => {
  console.log(`Proxy server listening on port ${port}`);
});
