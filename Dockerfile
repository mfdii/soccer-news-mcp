FROM registry.access.redhat.com/ubi9/nodejs-20:latest

USER root

# Install build dependencies
RUN dnf install -y python3 make g++ && dnf clean all

USER 1001

WORKDIR /opt/app-root/src

# Copy package files
COPY --chown=1001:0 package*.json tsconfig.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source code and scripts
COPY --chown=1001:0 src/ ./src/
COPY --chown=1001:0 scripts/ ./scripts/
COPY --chown=1001:0 data/ ./data/

# Build TypeScript
RUN npm run build

# Pre-download ML models to cache them in the image
# This speeds up container startup significantly
RUN node -e "import('@xenova/transformers').then(async m => { \
  const { pipeline, env } = m; \
  env.cacheDir = '/tmp/transformers-cache'; \
  console.log('Downloading embedding model...'); \
  await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'); \
  console.log('Downloading sentiment model...'); \
  await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english'); \
  console.log('Models cached successfully'); \
})"

# Copy cached models to persistent location
RUN mkdir -p /opt/app-root/src/.transformers-cache && \
    cp -r /tmp/transformers-cache/* /opt/app-root/src/.transformers-cache/ || true

# Set environment for model cache
ENV MODEL_CACHE_PATH=/opt/app-root/src/.transformers-cache

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Start the server
CMD ["npm", "start"]
