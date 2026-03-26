# Infisical Secrets Management

All secrets (SSH keys, API tokens, DB passwords, service credentials) are stored in Infisical.
**Never hardcode secrets.** Always retrieve them at runtime.

## How to Retrieve Secrets

### Via MCP (if available)
Use the `infisical` MCP tools: `get-secret`, `list-secrets`

### Via API (fallback)
```bash
# 1. Login with your team credentials (see below)
TOKEN=$(curl -s -X POST http://65.109.65.159:8880/api/v1/auth/universal-auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "clientId=$INFISICAL_CLIENT_ID&clientSecret=$INFISICAL_CLIENT_SECRET" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# 2. Get a secret
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://65.109.65.159:8880/api/v3/secrets/raw/SECRET_NAME?workspaceId=3137bc4e-69db-4d2d-b09e-563c78901729&environment=dev&secretPath=/folder/"
```

## Secret Organization

| Folder | Contains | Who needs it |
|--------|----------|-------------|
| `/ssh/` | Server IPs, SSH keys, passphrases | tech-team, devops |
| `/api-tokens/` | ERPNext, Paperclip, GitHub tokens | all teams |
| `/databases/` | DB connection strings, passwords | tech-team, devops |
| `/services/` | Storage boxes, Borg, Infisical self | tech-team, devops |

## Team Credentials

Each team has a scoped Machine Identity. Set these as env vars in your container:

| Team | Agents | INFISICAL_CLIENT_ID | Access |
|------|--------|---------------------|--------|
| tech-team | TechLead, BackendEng, FrontendEng | `69fa1d08-2fbb-4719-993d-e7a9d8434521` | admin (all secrets) |
| sales-team | SalesManager, SalesRep1 | `3d33e1f0-f8aa-431a-82e8-e807d0da6e50` | viewer (read only) |
| devops | DevOps | `6d19b297-0289-46d9-8e6c-1ae625fcd347` | admin (all secrets) |
| product-team | ProductManager, BetaTester | `74d61050-cf28-44d0-8d73-de91a6549a06` | viewer (read only) |

Client secrets are stored in: `/workspace/.agents/_common/infisical-secrets.env` (NOT committed to git)
