FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --audit=false --fund=false --strict-ssl=false

COPY . .
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=/socket.io
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
