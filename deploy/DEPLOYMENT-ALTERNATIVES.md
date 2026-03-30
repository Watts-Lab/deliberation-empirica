# Deployment Alternatives — Exploration Notes

## Current Setup
AWS + Terraform (in [deliberation-infrastructure](https://github.com/Watts-Lab/deliberation-infrastructure/tree/main/deliberation-empirica)). Works but is painful to maintain.

## Requirements
- Spin up ephemeral containers on-demand (per study, lasting a few hours)
- Tear down after study completes and data is saved
- Programmatic creation/destruction (API-driven, not manual)
- Multiple concurrent studies on different subdomains
- WebSocket support (Empirica requires it)
- Container runs on port 3000, needs env vars for external services (Daily, Qualtrics, Etherpad, GitHub)
- Data export happens via postFlight (pushes to GitHub) — Tajriba state may not need to survive container

## Platform Options

### Fly.io Machines API
- REST API for create/start/stop/destroy machines
- Auto-suspend idle machines, auto-start on request
- Per-second billing, no cost when stopped
- Good CLI for scripting

### AWS ECS Fargate (simplify existing AWS)
- Replace Terraform with a thin API calling `RunTask` / `StopTask`
- No EC2 management, pay-per-second
- Keeps existing container registry (GHCR) and AWS account

### Google Cloud Run
- Push image, API to spin up/tear down services per study
- Auto-scales to zero
- Simple API

### Modal / Beam
- Designed for ephemeral container workloads
- Least code to wire up
- May have limitations for long-running (multi-hour) WebSocket containers

## Open Questions
1. Does Tajriba state need to survive the container, or is the GitHub export the source of truth?
2. How does "study is done" get signaled? Empirica callback, or researcher clicks "shut down"?
3. How many concurrent studies at peak?
4. Who requests the server — team researchers or external users needing auth?
