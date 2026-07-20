# DesiSquare community simulation — 50 users, real dialogues, acceptance checks

An executable test that turns an **empty Discourse into a living DesiSquare** and verifies the v3 user stories against it: 50 pseudonymous members across 6 corridors (incl. 2 mavens), 15 realistic multi-turn discussions (59 replies) — FEMA repatriation, Roth-vs-traditional on H-1B, rebalancing bands, a $NVDA trim debate, FCNR rate shopping, ISA/TFSA/CPF/super corridor threads, a weekly ritual with a native poll, a maven AMA with pinned recap, and two policy-violating posts that exercise the private-flag → review-queue pipeline. Then it runs **14 acceptance use-cases (UC1–UC14)** mapped to the story corpus and writes a Markdown + JSON report.

Zero dependencies — Node 18+ only.

## Run against a live Discourse (Railway, GCP, anywhere)

1. Admin → API keys → **New API key**: scope *Global*, user level **All users** (the sim posts *as* each member via `Api-Username`).
2. ```bash
   DISCOURSE_URL=https://community.your-host.example \
   DISCOURSE_API_KEY=xxxxxxxxxxxx \
   node test/community-sim/run.mjs
   ```
3. Read `test/community-sim/report/DesiSquare-50-user-test-report.md`.

Options: `SIM_PACE_MS` (default 600ms between calls — stays inside default admin API rate limits), `SIM_USER_PASSWORD`, `SIM_EMAIL_DOMAIN` (default `sim.desisquare.invalid` — users are created `active: true`, so no activation email is ever sent), `SIM_VERBOSE=1`.

Idempotent-ish: re-runs treat existing usernames as OK and re-seed new topics (Discourse allows duplicate titles unless configured otherwise; wipe or use a fresh instance for a clean demo).

## Use-case → story traceability

| UC | Verifies | Stories |
|---|---|---|
| UC1 | 50 pseudonymous users provisioned, active, able to post | 1.2, 1.4 |
| UC2 | Topics land with labels (tags) | 14.1 |
| UC3 | Multi-turn threaded dialogue | 2.4 |
| UC4 | Structured reactions accrue | 3.1, 3.2 |
| UC5 | Search by general text | 4.1 |
| UC6 | Search by ticker label + label hub page | 4.6, 4.7, 20.1 |
| UC7 | Popular (Hot) ranks engagement | 2.1, F3 |
| UC8 | Accepted answers (Solved) | 21.1 input, Stage 8C |
| UC9 | Private flags → review queue | 3.3, 9.1, #3 |
| UC10 | Signed-out gate: member endpoints 403 anonymously | 1.1, 4.4, #7-A |
| UC11 | Leak scan: no E.164 / emails in thread payloads | 8.5, 12.5, #5 |
| UC12 | Member-view profiles expose no email | 1.4, 4.3 |
| UC13 | Native poll on the ritual thread | 18.4, 19.2 |
| UC14 | Engagement leaderboard derivable — never money | 18.1, 21.5, #9 |

WARN (not FAIL) is used where the check depends on instance configuration the runbooks own (Solved plugin off, `login_required` not yet enabled, Hot recompute lag).

## Harness self-test (no live forum needed)

```bash
node test/community-sim/mock/mock-discourse.mjs 3939 &
DISCOURSE_URL=http://127.0.0.1:3939 DISCOURSE_API_KEY=mock SIM_PACE_MS=0 node test/community-sim/run.mjs
```

The bundled mock implements exactly the endpoints the sim uses (including the login-required 403 behavior), so the full pipeline — users → dialogues → flags → discovery → report — can be validated before pointing at production. A self-test report is checked in under `report-selftest/`.

## Content rules honored by the corpus

- Pseudonyms only; generated emails live on a reserved `.invalid` domain and never appear in member-visible payloads (UC11/UC12 verify).
- Dialogue bodies are percent/ratio-based — no personal portfolio currency amounts — matching the leak-sweep posture (#4/#8) even though post bodies are member-authored content.
- Every "advice-shaped" thread carries educational framing; the two violating posts exist deliberately, to give moderators something real in `/review`.
