# CI and local gate

## Local pre-push hook
`npm install` runs `prepare`, which sets `core.hooksPath` to `.githooks`. `.githooks/pre-push`:
- Docs-only pushes (`docs/**`, `*.md`, `.superpowers/**`) and `workspace*/`-only pushes exit immediately.
- Anything else runs `npm run typecheck && npm test && npm run test:smoke`; a failure blocks the push.
- Bypass (CI still runs): `SKIP_PREPUSH=1 git push`.

Accumulate small changes locally and push in batches; the hook makes local verification mandatory.

## Workflows
- `deploy.yml`: on push to master. Path filters decide which builds run (diffed against the last
  successfully deployed commit). Superseded builds are cancelled; the deploy job (group `pages`) is never cancelled.
  Deploy updates the `gh-pages` branch (accumulated site state), then publishes it with
  `actions/deploy-pages` (Pages source = GitHub Actions, so no branch-build rate limit).
  `npm test` runs with `PROPERTY_SEEDS=100`. `release-portals` runs only when `games/*/game.json` changed.
- `nightly.yml`: 02:00 Asia/Taipei (and manual) runs typecheck and the full tests with `PROPERTY_SEEDS=300`.
