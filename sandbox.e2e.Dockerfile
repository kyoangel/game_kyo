FROM node:20-bookworm

WORKDIR /app

# 複製 Agent 寫好的工作區檔案
COPY ./workspace /app

# 安裝相依套件
RUN npm install

# 安裝 Playwright 與 Chromium（含系統相依套件）
RUN npx playwright install --with-deps chromium

# 預設執行命令：跑 Playwright 端對端測試
CMD ["sh", "-c", "npx playwright test"]
