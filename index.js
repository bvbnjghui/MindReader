// index.js - Cloud Run Node.js 代理服務

console.log(`[STARTUP_PHASE_0] 腳本開始執行...`);

import express from 'express';
console.log(`[STARTUP_PHASE_1] express 模組已載入。`);

import fetch from 'node-fetch'; // For making HTTP requests
console.log(`[STARTUP_PHASE_2] node-fetch 模組已載入。`);

import cors from 'cors'; // For handling CORS
console.log(`[STARTUP_PHASE_3] cors 模組已載入。`);

const app = express();
console.log(`[STARTUP_PHASE_4] Express 應用程式實例已創建。`);

// Cloud Run 會將埠號注入到 PORT 環境變數中
// 應用程式必須監聽這個埠號
const port = process.env.PORT || 8080;
console.log(`[STARTUP_PHASE_5] 監聽埠號設定為: ${port} (來自 PORT 環境變數: ${process.env.PORT})`);

// 從環境變數中讀取 Apps Script 網路應用程式 URL
const APPS_SCRIPT_WEB_APP_URL = process.env.APPS_SCRIPT_WEB_APP_URL;
if (!APPS_SCRIPT_WEB_APP_URL) {
  console.error(`[STARTUP_ERROR] 環境變數 APPS_SCRIPT_WEB_APP_URL 未設定！應用程式將無法正常運行。`);
  process.exit(1);
}
console.log(`[STARTUP_PHASE_6] Apps Script 後端 URL (從環境變數讀取): ${APPS_SCRIPT_WEB_APP_URL.substring(0, 30)}...`);

// 配置 CORS
app.use(cors({
  origin: '*',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
console.log(`[STARTUP_PHASE_7] CORS 中間件已配置。`);

// Express 中間件，用於解析 JSON 請求主體
app.use(express.json());
console.log(`[STARTUP_PHASE_8] JSON 解析中間件已配置。`);

// 處理 POST 請求的路由
app.post('/proxy', async (req, res) => {
  console.log(`[REQUEST] 收到來自前端的請求: ${req.method} ${req.originalUrl}`);
  try {
    // 新增 previous_dialog
    const { previous_dialog, dialog_text, context } = req.body;
    console.log(`[REQUEST] 請求主體: previous_dialog=${previous_dialog ? previous_dialog.substring(0, 50) + '...' : 'N/A'}, dialog_text=${dialog_text ? dialog_text.substring(0, 50) + '...' : 'N/A'}, context=${context}`);

    if (!dialog_text) {
      console.warn(`[ERROR] 缺少 dialog_text，返回 400 錯誤。`);
      return res.status(400).json({ status: 'error', detail: 'Missing dialog_text in request body.' });
    }

    console.log(`[PROXY] 正在轉發請求到 Apps Script: ${APPS_SCRIPT_WEB_APP_URL.substring(0, 30)}...`);
    const appsScriptResponse = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        previous_dialog: previous_dialog, // 轉發 previous_dialog
        dialog_text: dialog_text,
        context: context
      })
    });
    console.log(`[PROXY] 收到 Apps Script 響應，狀態碼: ${appsScriptResponse.status}`);

    // 無論 appsScriptResponse.ok 是否為 true，都先獲取原始文本內容
    const rawAppsScriptResponseText = await appsScriptResponse.text();
    console.log(`[PROXY] Apps Script 原始回應文本: ${rawAppsScriptResponseText}`);

    if (!appsScriptResponse.ok) {
      console.error(`[ERROR] Apps Script 返回錯誤狀態碼: ${appsScriptResponse.status}, 原始錯誤內容: ${rawAppsScriptResponseText}`);
      return res.status(appsScriptResponse.status).json({
        status: 'error',
        detail: `Apps Script 錯誤 (${appsScriptResponse.status}): ${rawAppsScriptResponseText}`
      });
    }

    // 嘗試解析為 JSON
    let appsScriptData;
    try {
        appsScriptData = JSON.parse(rawAppsScriptResponseText);
    } catch (jsonError) {
        console.error(`[ERROR] 無法將 Apps Script 回應解析為 JSON: ${jsonError.message}`);
        console.error(`[ERROR] 導致解析失敗的原始文本: ${rawAppsScriptResponseText}`);
        return res.status(500).json({
            status: 'error',
            detail: `Apps Script 回應格式錯誤，無法解析為 JSON。原始回應可能不是 JSON。`
        });
    }
    
    console.log(`[PROXY] 成功從 Apps Script 獲取數據。`);
    res.status(200).json(appsScriptData);

  } catch (error) {
    console.error(`[FATAL_ERROR] 代理服務器處理請求時發生錯誤: ${error.message}`, error);
    res.status(500).json({ status: 'error', detail: `代理服務器內部錯誤: ${error.message}` });
  }
});

// 啟動服務器並監聽指定埠號
try {
  console.log(`[STARTUP_PHASE_9] 嘗試啟動服務器監聽埠號 ${port}...`);
  app.listen(port, () => {
    console.log(`[STARTUP_SUCCESS] Proxy server 成功啟動並監聽埠號 ${port}`);
  });
} catch (err) {
  console.error(`[STARTUP_FAILURE] 服務器監聽埠號 ${port} 失敗: ${err.message}`, err);
  process.exit(1);
}


// 捕獲未處理的 Promise 拒絕和未捕獲的異常，以防止應用程式崩潰
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED_REJECTION] 未處理的 Promise 拒絕:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT_EXCEPTION] 未捕獲的異常:', err);
  process.exit(1);
});
