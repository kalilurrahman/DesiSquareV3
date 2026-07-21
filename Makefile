# DesiSquare V3 — local dev. Zero npm dependencies; Node 18+ (22 recommended).
.DEFAULT_GOAL := help
SERVICES := services/models-service services/wa-bridge services/gf-provisioner

.PHONY: help install dev app test smoke stop clean

help: ## Show this help
	@echo "DesiSquare V3 — targets:"
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | awk -F'\t' '{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Quick start:  make dev   →  http://localhost:5191"

install: ## Verify prerequisites (there are no packages to install — everything is zero-dependency)
	@node -e 'const v=+process.versions.node.split(".")[0]; if(v<18){console.error("Node 18+ required, found "+process.version);process.exit(1)} console.log("Node "+process.version+" OK — no npm install needed (zero-dependency stack).")'

dev: ## Run the v2/v3 product app + 3 services — Ctrl-C stops all
	@node scripts/dev-local.mjs

dev-v4: ## Run the v4 forum + Ghostfolio glue (gf-provisioner, wa-bridge, models-service) → :8786
	@node scripts/dev-v4.mjs

app: ## Run just the product app (services degrade to seeded fallback)
	@cd app && node serve.mjs

v4: ## Run just the v4 forum (services degrade / mock)
	@cd v4 && node server.mjs

test: ## Run every service's test suite
	@set -e; for s in $(SERVICES); do echo "== $$s =="; (cd $$s && node --test); done

smoke: ## Boot-and-check each service on an ephemeral port
	@set -e; for s in $(SERVICES); do echo "== $$s =="; (cd $$s && node scripts/smoke.js); done

community-test: ## Run the 50-user community simulation against a live Discourse (set DISCOURSE_URL, DISCOURSE_API_KEY)
	@node test/community-sim/run.mjs

stop: ## Kill anything left listening on the stack ports
	@for p in 5191 8786 8791 8788 8789; do pid=$$(lsof -ti tcp:$$p 2>/dev/null); [ -n "$$pid" ] && kill $$pid && echo "stopped :$$p" || true; done

clean: ## Remove service runtime state (data/state.json)
	@find services -path '*/data/state.json' -delete 2>/dev/null; echo "cleaned runtime state"
