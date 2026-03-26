---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `sanadai run`

One-command bootstrap and start:

```sh
pnpm sanadai run
```

Does:

1. Auto-onboards if config is missing
2. Runs `sanadai doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm sanadai run --instance dev
```

## `sanadai onboard`

Interactive first-time setup:

```sh
pnpm sanadai onboard
```

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm sanadai onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm sanadai onboard --yes
```

## `sanadai doctor`

Health checks with optional auto-repair:

```sh
pnpm sanadai doctor
pnpm sanadai doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `sanadai configure`

Update configuration sections:

```sh
pnpm sanadai configure --section server
pnpm sanadai configure --section secrets
pnpm sanadai configure --section storage
```

## `sanadai env`

Show resolved environment configuration:

```sh
pnpm sanadai env
```

## `sanadai allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm sanadai allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.sanad-ai-eoi/instances/default/config.json` |
| Database | `~/.sanad-ai-eoi/instances/default/db` |
| Logs | `~/.sanad-ai-eoi/instances/default/logs` |
| Storage | `~/.sanad-ai-eoi/instances/default/data/storage` |
| Secrets key | `~/.sanad-ai-eoi/instances/default/secrets/master.key` |

Override with:

```sh
PAPERCLIP_HOME=/custom/home PAPERCLIP_INSTANCE_ID=dev pnpm sanadai run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm sanadai run --data-dir ./tmp/sanad-ai-eoi-dev
pnpm sanadai doctor --data-dir ./tmp/sanad-ai-eoi-dev
```
