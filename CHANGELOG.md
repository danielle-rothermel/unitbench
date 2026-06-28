# Changelog

## 2026-06-28

### Vercel production deployment

- Created a new Vercel project named `unitbench` under the
  `danielle-rothermels-projects` team.
- Confirmed the project should deploy as a Next.js app from the repository root
  with pnpm:
  - framework preset: `Next.js`
  - root directory: `.`
  - install command: Vercel default, using `pnpm install`
  - build command: Vercel default, using `pnpm run build`
  - output directory: Next.js default
- Verified the production build locally with `pnpm build`.
- Installed and used the Vercel CLI through `pnpm dlx vercel@latest` because no
  global `vercel` command was available.
- Created the Vercel project with:
  `pnpm dlx vercel@latest project add unitbench --scope danielle-rothermels-projects`.
- The first production deployment attempt built successfully but failed because
  Vercel had created the project with the `Other` framework preset and expected
  a `dist` output directory.
- Patched the Vercel project settings through the Vercel API to use the `Next.js`
  framework preset and the default Next.js output directory.
- Redeployed successfully to production.
- Final production alias:
  `https://unitbench.vercel.app`
- Final deployment ID:
  `dpl_8JWozBJxxT79Mwtp8W1vRQWfb5iE`
- Final deployment inspect URL:
  `https://vercel.com/danielle-rothermels-projects/unitbench/8JWozBJxxT79Mwtp8W1vRQWfb5iE`
- Added `.vercelignore` with `.env` and `.env.*` so direct Vercel CLI deploys do
  not upload local environment files.
- Confirmed the production URL returned HTTP 200 after deployment.

### Follow-up setup completed in the Vercel UI

- Added the `DATABASE_URL` environment variable in the Vercel project settings.
- Connected the Vercel project to the Git repository through the Vercel UI so
  future pushes and pull requests can use Git-backed deployments.
