---
name: press-provision
description: >
  Full server-to-site provisioning for self-hosted Frappe Press. Handles new server bootstrap,
  proxy configuration, nginx routing, TLS certs, agent setup, and site creation verification.
  Includes infrastructure health checks and automated test suite.

  ALWAYS trigger this skill when the user:
  - Asks to provision a new server for Press
  - Asks to create/debug a new site on the Press platform
  - Reports "Are you lost?", 502, 504, or site not loading on sandbox/demo domains
  - Wants to verify Press infrastructure health
  - Says "provision", "bootstrap server", "new server", "press health check", "site not working"
  - Asks about proxy routing, upstream config, or nginx issues on Press servers

  Do NOT trigger for:
  - AccuBuild/ERPNext app development (use erpnext-* skills)
  - Press dashboard UI/rebrand work (use clean-code/create-prototype)
  - General nginx questions not related to Press proxy routing
argument-hint: 'server-name, site-name, or "health-check"'
---

# press-provision: Server-to-Site Provisioning for Self-Hosted Press

End-to-end provisioning and verification for self-hosted Frappe Press infrastructure.
Covers the full pipeline: server bootstrap -> proxy config -> site creation -> health verification.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   press-ctrl    │     │     press-f1     │     │       u4        │
│  89.167.116.92  │     │  89.167.57.21    │     │ 157.90.244.216  │
│                 │     │                  │     │                 │
│  Press App      │────>│  Proxy Server    │────>│  App Server     │
│  Dashboard      │     │  (nginx routing) │     │  (benches/sites)│
│  MariaDB        │     │  Agent           │     │  Agent          │
│  Certbot        │     │  TLS termination │     │  Docker         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Data flow for site access:**
1. DNS `*.sandbox.mvpstorm.com` -> press-f1 (proxy)
2. nginx matches `server_name *.sandbox.mvpstorm.com` in proxy.conf
3. `$host` -> `$actual_host` map -> `$upstream_server_hash` map -> upstream backend
4. Upstream `server IP:80` -> app server (u4) -> Docker container -> Frappe site

## Input Parsing

Parse the user's invocation:
- `/press-provision health-check` -> Run full infrastructure health check
- `/press-provision new-server SERVER_NAME` -> Bootstrap new app server
- `/press-provision debug-site SITE_NAME` -> Debug why a site isn't loading
- `/press-provision new-site SITE_NAME` -> Create and verify a new site
- No argument -> Show available commands

## Pre-Flight

Before any operation:

1. **Verify SSH access to all servers**:
   ```bash
   # press-ctrl
   ssh -i "E:/.ssh/new_id_ed25519" root@89.167.116.92 "echo ok"
   # press-f1 (via press-ctrl)
   ssh -i "E:/.ssh/new_id_ed25519" root@89.167.116.92 "ssh root@89.167.57.21 'echo ok'"
   # u4 (via press-ctrl)
   ssh -i "E:/.ssh/new_id_ed25519" root@89.167.116.92 "ssh root@157.90.244.216 'echo ok'"
   ```

2. **Verify agent processes running** on press-f1 and u4:
   ```bash
   supervisorctl status agent:
   ```

3. **Check memory file** `frappe-press-lessons.md` for known issues

## Operation: Health Check

Deploy and run the infrastructure test suite on press-f1:

```bash
# SCP test script to press-f1
scp press_infra_tests.py press-ctrl:/tmp/
ssh press-ctrl "scp /tmp/press_infra_tests.py root@89.167.57.21:/tmp/"
ssh press-ctrl "ssh root@89.167.57.21 'python3 /tmp/press_infra_tests.py'"
```

### Test Levels

**Level 1 — Data Source Integrity:**
- Each host `map.json` key matches its directory name
- Each upstream `ip_override` file has valid, reachable IP
- No duplicate map keys across all hosts
- Agent TLS cert is NOT a wildcard (specific to hostname only)

**Level 2 — Code Patches Integrity:**
- `proxy.py` has ip_override support (reads file, stores actual_ip, skips from sites)
- Proxy Jinja2 template uses `upstream.get("actual_ip", name)` for server directive
- `nginx.conf` template has `proxy_conf_path` conditional include
- `server.py` passes `proxy_conf_path` to template context
- All patched Python files pass syntax validation

**Level 3 — Generated Config Validation:**
- `nginx.conf` includes `proxy.conf`
- `proxy.conf` has no duplicate map entries
- All upstream IPs in generated proxy.conf are reachable
- `nginx -t` succeeds
- All active sites return HTTP 2xx/3xx (not 502/504)

### Expected Results
- 32+ tests pass
- Only known failures: Archived sites returning 502 (expected)

## Operation: New Server Bootstrap

When provisioning a new app server from scratch:

### Step 1: Create Server Record in Press
```python
# On press-ctrl bench console:
server = frappe.new_doc("Server")
server.hostname = "NEW_HOSTNAME"
server.ip = "PUBLIC_IP"
server.private_ip = "PUBLIC_IP"  # CRITICAL: use public IP if no private network
server.cluster = "Default"
server.provider = "Generic / Self Hosted"
server.save()
frappe.db.commit()
```

**CRITICAL: Set `private_ip = ip` (public IP)** when no Hetzner private network exists.
Otherwise proxy upstream configs will use unreachable IPs. (Lesson 93)

### Step 2: Bootstrap Server
```python
# On press-ctrl:
bench --site demo.mvpstorm.com execute press.do_retry.bootstrap_new_server \
  --args '["SERVER_NAME"]'
# Wait for Ansible job, then:
bench --site demo.mvpstorm.com execute press.do_retry.post_ansible_setup \
  --args '["SERVER_NAME"]'
```

### Step 3: Verify Proxy Config on press-f1

After bootstrap, verify these on press-f1:

1. **Upstream directory exists**: `/home/frappe/agent/nginx/upstreams/PUBLIC_IP/`
2. **If IP override needed**: Create `/home/frappe/agent/nginx/upstreams/PRIVATE_IP/ip_override` with public IP
3. **Host map.json correct**: Check `/home/frappe/agent/nginx/hosts/*.DOMAIN/map.json` has matching key
4. **proxy.conf included**: `grep "proxy.conf" /home/frappe/agent/nginx/nginx.conf`
5. **nginx -t passes**: `nginx -t && systemctl reload nginx`

### Step 4: Verify Agent Connectivity
```python
bench --site demo.mvpstorm.com execute press.do_retry.ping_server_agent_authed \
  --args '["SERVER_NAME"]'
```

### Step 5: Verify Agent Callback
- Agent `config.json` must have `press_url: "https://autodeploypanel.mvpstorm.com"` (Lesson 91)
- Test: create a test site and verify the Agent Job completes (status = Success)

## Operation: Debug Site

When a site shows "Are you lost?", 502, or 504:

### Diagnostic Tree

```
Site not loading?
  │
  ├─ curl from press-f1: curl -sk https://SITE/
  │   ├─ "Are you lost?" → nginx routing issue
  │   │   ├─ Check proxy.conf included in nginx.conf
  │   │   ├─ Check $actual_host map has domain pattern
  │   │   ├─ Check agent.conf TLS cert isn't wildcard
  │   │   └─ Check upstream IP is reachable
  │   ├─ 502 Bad Gateway → upstream unreachable
  │   │   ├─ Check upstream IP in proxy.conf
  │   │   ├─ Check Docker container running on app server
  │   │   ├─ Check gunicorn port matches upstream
  │   │   └─ Check proxy_buffer_size (if 502 only after login)
  │   ├─ 504 Gateway Timeout → upstream slow/dead
  │   │   ├─ Check app server health (CPU/memory)
  │   │   ├─ Check MariaDB on app server
  │   │   └─ Check gunicorn workers
  │   └─ 200 OK → site works from server, DNS/cert issue
  │       ├─ Check DNS resolution
  │       └─ Check TLS cert for domain
  │
  ├─ Site stuck "Installing" → agent callback failed
  │   ├─ Check agent logs: /home/frappe/agent/logs/worker.error.log
  │   ├─ Check press_url matches SSL cert hostname
  │   └─ Manually set site Active + Agent Job Success
  │
  └─ Site "Broken" → app/migration issue
      ├─ Check bench logs in Docker container
      └─ May need new Deploy Candidate + rebuild
```

### Quick Diagnostic Commands

```bash
# From press-f1: test site routing
curl -sk -o /dev/null -w "%{http_code} %{redirect_url}" https://SITE/

# Check which upstream a site maps to
grep "SITE" /home/frappe/agent/nginx/proxy.conf

# Check upstream IP
grep -A2 "upstream HASH" /home/frappe/agent/nginx/proxy.conf

# Check if proxy.conf is loaded
nginx -T 2>/dev/null | grep "proxy.conf"

# Check agent.conf cert
openssl x509 -in /home/frappe/agent/tls/fullchain.pem -noout -subject -ext subjectAltName

# Full nginx config test
nginx -t

# On app server: check site exists in container
docker exec CONTAINER_NAME ls sites/SITE/site_config.json
```

## Key Files on press-f1 (Proxy Server)

| File | Purpose | Auto-regenerated? |
|------|---------|-------------------|
| `/home/frappe/agent/nginx/nginx.conf` | Main nginx config, includes others | Yes (by agent) |
| `/home/frappe/agent/nginx/proxy.conf` | All proxy routing (upstreams, maps, server blocks) | Yes (by agent) |
| `/home/frappe/agent/nginx.conf` | Agent management interface (agent.conf) | Yes (by agent) |
| `/home/frappe/agent/nginx/upstreams/<IP>/` | Upstream data dirs (sites + ip_override) | Managed by Press API |
| `/home/frappe/agent/nginx/hosts/<domain>/map.json` | Host-to-actual_host mappings | Managed by Press API |
| `/home/frappe/agent/tls/fullchain.pem` | Agent TLS cert (should be hostname-specific) | Manual |
| `/home/frappe/agent/repo/agent/proxy.py` | Proxy config generation code | Patched |
| `/home/frappe/agent/repo/agent/server.py` | Server config generation code | Patched |
| `/home/frappe/agent/repo/agent/templates/proxy/nginx.conf.jinja2` | Proxy config template | Patched |
| `/home/frappe/agent/repo/agent/templates/nginx/nginx.conf.jinja2` | Main nginx config template | Patched |

## Patches Applied (Must Survive Agent Updates)

These patches were applied to the agent code on press-f1. If the agent is updated (git pull),
these patches need to be reapplied:

### 1. proxy.py — ip_override support
**Location:** `upstreams` property
**What:** Reads `ip_override` file from upstream directory, stores as `actual_ip`, skips file from site list
**Why:** Upstream dirs are named by private IP which may be unreachable without private network

### 2. proxy.py template — actual_ip in server directive
**Location:** `templates/proxy/nginx.conf.jinja2`
**What:** Changed `server {{ name }}:80` to `server {{ upstream.get("actual_ip", name) }}:80`
**Why:** Uses overridden IP for upstream server directive while keeping hash intact

### 3. nginx.conf template — proxy_conf_path include
**Location:** `templates/nginx/nginx.conf.jinja2`
**What:** Added conditional `include {{ proxy_conf_path }};` before other includes
**Why:** Unified servers (app + proxy) need proxy.conf included; standard Press separates these roles

### 4. server.py — pass proxy_conf_path
**Location:** `_generate_nginx_config()` method
**What:** Added `proxy_conf_path` to template context, checks if proxy.conf exists
**Why:** Template needs the path to conditionally include proxy.conf

### 5. Agent TLS certs — hostname-specific
**Location:** `/home/frappe/agent/tls/`
**What:** Replaced wildcard `*.sandbox` certs with self-signed cert for `press-f1.sandbox.mvpstorm.com` only
**Why:** Wildcard cert caused agent.conf to steal all `*.sandbox` requests via SNI matching (Lesson 95)

## Lessons Reference

See `frappe-press-lessons.md` for detailed lessons:
- 90-99: Server provisioning, proxy routing, nginx config, agent fixes
- 75-79: Bootstrap script and future server provisioning
- 80-88: Dashboard issues and root-cause fixes
- 51: Upstream self-loop causing 502
- 65: Proxy buffer overflow causing 502 after login

## Test Script Location

The infrastructure test script is at `/tmp/press_infra_tests.py` on press-f1.
Local copy: `C:\Users\CDIT\.tmp\press_infra_tests.py`

Run anytime to verify health:
```bash
ssh press-ctrl "ssh root@89.167.57.21 'python3 /tmp/press_infra_tests.py'"
```

Expected: 32+ pass, 0 fail (excluding Archived sites)
