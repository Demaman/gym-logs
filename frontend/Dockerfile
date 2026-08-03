FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@9

# Install deps first — this layer is cached until lockfile changes
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY . .

EXPOSE 3000

# Bind to all interfaces so Docker can route traffic in
ENV HOSTNAME=0.0.0.0

CMD ["pnpm", "dev"]
