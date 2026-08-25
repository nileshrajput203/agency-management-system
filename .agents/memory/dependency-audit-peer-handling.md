---
name: Dependency audit peer handling
description: Why automatic peer installation is disabled for the AgencyOS workspace
---

The workspace disables automatic peer installation because some production packages declare optional ecosystem peers that are not used by the application but pull vulnerable transitive packages into the lockfile.

**Why:** The security audit reported a vulnerable image parser only through an unused React Native peer of the SQL fallback package; disabling automatic peer installation removed the chain without changing the PostgreSQL runtime.

**How to apply:** Keep `auto-install-peers=false` in the workspace package-manager configuration. If a future feature genuinely needs a peer, add that peer explicitly and audit its dependency tree.