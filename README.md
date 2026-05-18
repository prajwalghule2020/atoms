Next.js single-app migration workspace

This folder contains the consolidated Next.js app migrated from the monorepo `apps/web` and supporting packages (`db`, `validators`).

Quick start:

1. Copy your environment variables into `.env.local` (already created here).
2. Install dependencies: `pnpm install` (from repo root or run inside this folder).
3. Run dev: `pnpm --filter nextapp dev` or `pnpm dev` if working inside this folder.
