# 使用官方 Node.js 映像作為基礎
FROM node:18-slim

# 設定工作目錄
WORKDIR /app

# 將 package.json 和 package-lock.json 複製到工作目錄
COPY package*.json ./

# 安裝依賴
RUN npm install

# 將所有應用程式程式碼複製到工作目錄
COPY . .

# 暴露應用程式運行的埠號
EXPOSE 8080

# 定義啟動命令
CMD ["npm", "start"]
