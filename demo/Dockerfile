# DesiSquare cutdown demo — prototype + reports, zero dependencies.
# Built from the repo root: docker build -f demo/Dockerfile .
FROM node:22-alpine
WORKDIR /app
COPY demo/server.mjs demo/server.mjs
COPY docs/desisquare-wireframes-v4-prototype.html docs/desisquare-wireframes-v4-prototype.html
COPY docs/desisquare-user-stories.md docs/desisquare-user-stories.md
COPY test/community-sim/report-selftest/ test/community-sim/report-selftest/
COPY deploy/CLIENT-INFRA-CHECKLIST.md deploy/CLIENT-INFRA-CHECKLIST.md
ENV PORT=8080
EXPOSE 8080
CMD ["node", "demo/server.mjs"]
