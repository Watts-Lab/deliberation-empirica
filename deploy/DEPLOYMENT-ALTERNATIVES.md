# Deployment Alternatives — Exploration Notes

## Current Setup
AWS + Terraform (in [deliberation-infrastructure](https://github.com/Watts-Lab/deliberation-infrastructure/tree/main/deliberation-empirica)). Works but is painful to maintain.

## Requirements
- Spin up ephemeral containers on-demand (per study, lasting a few hours)
- One container per experiment — no load balancing, the single server must handle all participants
- Up to 100+ concurrent participants per study
- Tear down after study completes and data is exported
- Programmatic creation/destruction (API-driven, not manual)
- Multiple concurrent studies on different subdomains
- WebSocket support (Empirica requires it)
- Container runs on port 3000, needs env vars for external services (Daily, Qualtrics, Etherpad, GitHub)
- Data export happens via postFlight (pushes to GitHub) — Tajriba state does not need to survive container
- Researcher or management server signals "study is done"; fallback 12hr TTL auto-teardown

## Recommended Approach: Railway + Management Server

### Why Railway
- Already have familiarity/account
- Full GraphQL API (`https://backboard.railway.com/graphql/v2`) for programmatic service lifecycle
- Docker image deploys from GHCR — no rebuild needed
- WebSocket support out of the box
- Services stay running until explicitly deleted (no unwanted auto-suspend)
- Pro plan supports up to 32GB RAM / 8 vCPU per service
- Per-minute billing; a few-hour study on 2GB/1vCPU costs ~$0.01-0.05
- Custom subdomains via API, or wildcard domain (`*.studies.yourdomain.com`)

### API Flow (per study)

1. **Create service** — `serviceCreate` mutation with `source.image` pointing to GHCR image
2. **Set env vars** — `variableUpsert` for DAILY_APIKEY, QUALTRICS_API_TOKEN, SUBDOMAIN, etc.
3. **Attach domain** — `customDomainCreate` for `study-xyz.yourdomain.com`
4. **Wait for deployment** — service starts automatically after creation
5. **Tear down** — `serviceDelete` when researcher signals done or TTL expires

### Management Server Architecture

```
[Researcher UI] → [Management Server (always-on Railway service)]
                         |
                         ├── Railway GraphQL API (create/delete study services)
                         ├── SQLite/Postgres (tracks active studies, TTLs, researcher info)
                         └── Timer/cron (reaps studies past 12hr TTL)
```

The management server is a single small always-on service in the same Railway project.

### Sizing Guide
| Study size       | Recommended tier  | Approx. cost/hr |
|------------------|-------------------|------------------|
| < 30 participants | 1GB RAM / shared CPU | ~$0.005 |
| 30–100 participants | 2GB RAM / 1 vCPU | ~$0.01 |
| 100+ participants | 4GB RAM / 2 vCPU | ~$0.03 |

Video load is handled by Daily.co, not the study server — Empirica just manages lightweight JSON state sync over WebSocket.

### References
- [Railway API Cookbook](https://docs.railway.com/guides/api-cookbook)
- [Manage Services API](https://docs.railway.com/guides/manage-services)
- [Railway Public API](https://docs.railway.com/guides/public-api)
- [Railway Domains](https://docs.railway.com/networking/domains)

## Other Options Considered

### Fly.io Machines API
- REST API for create/start/stop/destroy machines
- Auto-suspend idle machines, auto-start on request (not wanted — we need always-on)
- Per-second billing, no cost when stopped
- Good CLI for scripting
- Would also work well, but less familiar

### AWS ECS Fargate (simplify existing AWS)
- Replace Terraform with a thin API calling `RunTask` / `StopTask`
- No EC2 management, pay-per-second
- Keeps existing container registry (GHCR) and AWS account
- Still more complex than Railway

### Google Cloud Run
- Auto-scales to zero — not suitable for long-running WebSocket sessions

### Modal / Beam
- Designed for short-lived workloads — may not support multi-hour WebSocket containers well
