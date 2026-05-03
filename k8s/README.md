# OpenShift Deployment for Soccer News MCP

## Prerequisites

- OpenShift 4.21.8 cluster access
- GitHub repository: https://github.com/mfdii/soccer-news-mcp
- cert-manager with Let's Encrypt configured

## Deployment Order

### 1. Create Namespace

```bash
oc apply -f postgres/namespace.yaml
```

### 2. Update Secrets

Generate a strong password and update both secrets:

```bash
# Generate password
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Update postgres secret
sed -i "s/changeme-generate-strong-password/$POSTGRES_PASSWORD/g" postgres/secret.yaml
sed -i "s/changeme-generate-strong-password/$POSTGRES_PASSWORD/g" app/secret-env.yaml

# Apply secrets
oc apply -f postgres/secret.yaml
oc apply -f app/secret-env.yaml
```

### 3. Deploy PostgreSQL

```bash
oc apply -f postgres/pvc.yaml
oc apply -f postgres/configmap.yaml
oc apply -f postgres/statefulset.yaml
oc apply -f postgres/service.yaml
```

Wait for PostgreSQL to be ready:

```bash
oc wait --for=condition=ready pod -l app=postgres -n soccer-news --timeout=300s
```

Verify pgvector extension:

```bash
oc exec -n soccer-news postgres-0 -- psql -U soccernews -d soccer_news -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### 4. Build Application Image

```bash
oc apply -f app/imagestream.yaml
oc apply -f app/buildconfig.yaml
```

Trigger initial build:

```bash
oc start-build soccer-news-mcp -n soccer-news --follow
```

### 5. Run Database Migrations

```bash
oc apply -f job-migrate.yaml
```

Wait for migration to complete:

```bash
oc wait --for=condition=complete job/soccer-news-migrate -n soccer-news --timeout=300s
oc logs -n soccer-news job/soccer-news-migrate
```

### 6. Seed RSS Sources

```bash
oc apply -f job-seed.yaml
```

Wait for seeding to complete:

```bash
oc wait --for=condition=complete job/soccer-news-seed -n soccer-news --timeout=300s
oc logs -n soccer-news job/soccer-news-seed
```

### 7. Deploy Application

```bash
oc apply -f app/deployment.yaml
oc apply -f app/service.yaml
oc apply -f app/route.yaml
```

Wait for deployment:

```bash
oc wait --for=condition=available deployment/soccer-news-mcp -n soccer-news --timeout=600s
```

Note: Initial startup takes 60-90 seconds due to ML model loading.

### 8. Verify Deployment

```bash
# Check pod status
oc get pods -n soccer-news

# Check logs
oc logs -n soccer-news -l app=soccer-news-mcp --tail=50

# Health check
curl https://soccer-news.example.com/health

# Readiness check
curl https://soccer-news.example.com/ready
```

## Testing the MCP Server

### Initialize MCP Session

```bash
curl -X POST https://soccer-news.example.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "jsonrpc": "2.0",
    "id": 1
  }'
```

Save the `mcp-session-id` header from the response.

### List Sources

```bash
SESSION_ID="your-session-id-here"

curl -X POST https://soccer-news.example.com/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "list-sources",
      "arguments": {}
    },
    "jsonrpc": "2.0",
    "id": 2
  }'
```

### Fetch News

```bash
curl -X POST https://soccer-news.example.com/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "fetch-feeds",
      "arguments": {
        "maxArticlesPerSource": 5
      }
    },
    "jsonrpc": "2.0",
    "id": 3
  }'
```

### Search News

```bash
curl -X POST https://soccer-news.example.com/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "search-news",
      "arguments": {
        "query": "Manchester United transfer news",
        "limit": 5
      }
    },
    "jsonrpc": "2.0",
    "id": 4
  }'
```

## Updating the Application

### Rebuild from Git

```bash
oc start-build soccer-news-mcp -n soccer-news --follow
```

The deployment will automatically roll out the new image.

### Manual Rollout

```bash
oc rollout restart deployment/soccer-news-mcp -n soccer-news
oc rollout status deployment/soccer-news-mcp -n soccer-news
```

## Troubleshooting

### Check PostgreSQL

```bash
oc exec -n soccer-news postgres-0 -- psql -U soccernews -d soccer_news -c "\dt"
```

### Check Application Logs

```bash
oc logs -n soccer-news -l app=soccer-news-mcp -f
```

### Check Build Logs

```bash
oc logs -n soccer-news bc/soccer-news-mcp --follow
```

### Check Resource Usage

```bash
oc adm top pods -n soccer-news
```

### Re-run Migrations

```bash
oc delete job soccer-news-migrate -n soccer-news
oc apply -f job-migrate.yaml
```

### Re-seed Sources

```bash
oc delete job soccer-news-seed -n soccer-news
oc apply -f job-seed.yaml
```

## Scaling

The application is stateless and can be scaled horizontally:

```bash
oc scale deployment/soccer-news-mcp -n soccer-news --replicas=3
```

Note: Each replica loads ML models into memory (~500MB overhead).

## Resource Requirements

- **PostgreSQL**: 1-4Gi RAM, 500m-2000m CPU, 50Gi storage
- **Application**: 2-8Gi RAM (ML models), 1000m-4000m CPU
- **Recommended**: 2 app replicas, 1 PostgreSQL instance

## Cleanup

```bash
oc delete namespace soccer-news
```
