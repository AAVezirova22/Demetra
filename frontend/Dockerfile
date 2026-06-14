FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Expose Vite on all network interfaces inside the container
CMD ["npm", "run", "dev", "--", "--host"]