# Love & Sunshine

An original public website and admin-workspace prototype for Love & Sunshine, an artist-development and songwriting practice.

## What is included

- Responsive public site, guided artist-start path, and co-writing inquiry flow.
- A local, synthetic-data team workspace for artists, projects, songs/splits, billing, inquiries, calendar, files, and integration setup.
- Integration setup UI that only prompts for a provider's required environment-variable names after the owner selects **Connect**. It neither requests nor stores credentials.

## Run locally

This is dependency-free static HTML. Open `index.html` in a browser, or serve it from any static server. A Node runtime was not available in the supplied workspace, so no framework build or automated tests were run.

## Provider setup

Create Love & Sunshine-owned accounts directly with each provider before enabling an integration: Stripe, Resend, Google Cloud, Microsoft Entra, Cloudflare, and optionally OpenAI. Add real values only to an untracked `.env.local` file after the application is moved to a server-backed implementation.

See `docs/INTEGRATION_SETUP.md` for the intended credentials and safeguards.
