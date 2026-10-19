---
name: Custom artifact service configuration
description: Non-obvious rules for adding managed services to an existing web artifact.
---

When adding a second managed service to a web artifact, configure production commands with nested `build` and `run` tables containing `args`. Artifact workflow commands start from the artifact directory, not the workspace root. Resolve paths from that directory and validate a complete temporary TOML file before replacing the active configuration.

**Why:** TOML can parse successfully but fail artifact-schema validation, and workspace-root-relative paths can fail when the managed workflow starts from the artifact directory.

**How to apply:** Check an existing artifact's production config for the accepted shape, calculate paths from the artifact working directory, then use the artifact config validator before restarting the service.
