# DesiSquare demo in a box (cutdown version)

One zero-dependency Node server that serves the **v4 interactive prototype** (the full clickable walkthrough: landing digest → sign-in roles → live feed → chat dock → events → leaderboard → ticker hub → mod queue), the **50-user simulation self-test report**, the **user stories**, and the **client infra checklist**.

This is the *demo tier* — no real Discourse/Ghostfolio (those need the VMs per `deploy/CLIENT-INFRA-CHECKLIST.md`). It exists so stakeholders can click through the product today.

## Run locally

```bash
node demo/server.mjs          # → http://localhost:8080
```

Routes: `/` prototype · `/report` 50-user test report · `/stories` user stories v3 · `/checklist` infra checklist · `/health` JSON health.

Docker (optional): `docker build -f demo/Dockerfile -t desisquare-demo . && docker run -p 8080:8080 desisquare-demo`

## Deploy to Railway (one command)

The repo root carries `railway.json` (Dockerfile builder → `demo/Dockerfile`, healthcheck `/health`).

```bash
npm i -g @railway/cli
railway login
railway init          # new project, pick a name (e.g. desisquare-demo)
railway up            # builds demo/Dockerfile, deploys
railway domain        # generate the public URL
```

Or dashboard-only: New Project → Deploy from GitHub repo → `kalilurrahman/DesiSquareV3` (it picks up `railway.json` automatically) → Generate Domain.

Costs pennies on the Hobby plan (static-ish Node service, no databases). All pages send `X-Robots-Tag: noindex` — this is a private demo, not a public site.

## What this is NOT

- Not the real forum: sign-ins are simulated roles, data is seeded fixture data, nothing persists.
- Not the deployment target for the actual product — that's `deploy/gcp/` (Discourse VM + apps VM), with `deploy/railway/` documenting the hybrid option for Ghostfolio.
