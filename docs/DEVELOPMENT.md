# Local Development — TEACH Ticket System

This document covers local setup and day-to-day development commands for the Phase 1 application scaffold. It does not cover any database, authentication, or ticket functionality — none of that exists yet (see [`PHASE_PLAN.md`](PHASE_PLAN.md)).

## Prerequisites

- **Node.js 24 (LTS)** — the version pinned in [`.nvmrc`](../.nvmrc) and declared in `package.json`'s `engines` field. If you use [nvm](https://github.com/nvm-sh/nvm), running `nvm use` in the repository root will select the correct version automatically.
- **npm** (ships with Node.js) — this project uses npm exclusively. Do not use Yarn, pnpm, or Bun; only one lockfile (`package-lock.json`) is maintained.

## Initial Setup

```bash
npm ci
```

`npm ci` installs exactly what is recorded in `package-lock.json`. Use it instead of `npm install` for a clean, reproducible install (including in CI).

## Local Development

```bash
npm run dev
```

The app starts at **http://localhost:3000**. The root route (`/`) renders a static application-status page — there is no sign-in, ticket submission, or other functional workflow yet.

## Quality Commands

| Command                | Purpose                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run lint`         | Run ESLint.                                                                                      |
| `npm run typecheck`    | Run the TypeScript compiler in check-only mode (`tsc --noEmit`).                                 |
| `npm test`             | Run the Vitest suite once (non-watch).                                                           |
| `npm run test:watch`   | Run Vitest in watch mode while developing.                                                       |
| `npm run format`       | Apply Prettier formatting to the repository.                                                     |
| `npm run format:check` | Verify formatting without writing changes.                                                       |
| `npm run check`        | Run, in order: format check → lint → typecheck → tests. This is the single command CI relies on. |

## Production Build and Local Start

```bash
npm run build
npm run start
```

`npm run build` produces an optimized production build; `npm run start` serves that build locally (also on port 3000 by default). Use `npm run dev` for day-to-day development instead.

## Environment Files

- `.env.example` is tracked in the repository and documents environment-variable names and safe placeholders only.
- Phase 1 requires no environment variables — `.env.example` exists purely to establish the pattern for later phases.
- Real values belong in a local, git-ignored file (e.g. `.env`, `.env.local`) or in managed deployment secrets — never in `.env.example` and never committed to source control.
- **Never commit real credentials, tokens, keys, connection strings, or other secrets under any filename.**

## What Phase 1 Does Not Include

This scaffold is intentionally feature-empty. It contains no database, no authentication, and no ticket-system functionality (submission, routing, queues, assignment, SLAs, email, attachments, etc.). Those are addressed in later, separately approved phases.

## Continuous Integration

Every push and pull request runs the [`quality`](../.github/workflows/quality.yml) GitHub Actions workflow, which performs (on Ubuntu, Node.js 24):

1. `npm ci`
2. `npm run check` (format check, lint, typecheck, tests)
3. `npm run build`

The workflow uses read-only repository contents permission, no repository secrets, and does not deploy anything.

## Troubleshooting: Node Version Mismatches

If `npm run dev`, `npm ci`, or the test/build commands behave unexpectedly, first confirm your active Node version matches the pinned version:

```bash
node --version   # should match the major version in .nvmrc
```

If it doesn't match and you use nvm, run `nvm install` followed by `nvm use` from the repository root. Mismatched Node major versions are the most common cause of otherwise-unexplained install or build failures in this project.
