FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

ENV NODE_ENV=production
ENV TZ=America/Sao_Paulo

CMD ["npm", "start"]
