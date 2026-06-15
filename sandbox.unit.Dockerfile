FROM node:20-alpine
WORKDIR /app
COPY ./workspace /app
RUN npm install
CMD ["sh", "-c", "npm run test:unit"]
