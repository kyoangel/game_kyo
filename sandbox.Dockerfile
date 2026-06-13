FROM node:20-alpine

WORKDIR /app

# 複製 Agent 寫好的工作區檔案
COPY ./workspace /app

# 安裝 Vite、TypeScript 與測試所需的基礎工具
RUN npm install -g typescript vite

# 預設執行命令：進行 TypeScript 型別檢查與 Vite 打包測試
CMD ["sh", "-c", "npx tsc --noEmit && npm run build"]
