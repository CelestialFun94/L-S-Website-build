# Love & Sunshine

An original public website and secure admin workspace for Love & Sunshine, an artist-development and songwriting practice.

## What is included

- Responsive public site, guided artist-start path, and co-writing inquiry flow.
- A Supabase-backed admin workspace for CRM, projects, tasks, activity, songs/splits, billing, inquiries, bookings, files, operator review items, team access, audit history, and integration setup.
- A tracked `public/images` library for approved public website imagery, including the supplied Love & Sunshine brand sources.
- Integration setup UI that only prompts for a provider's required environment-variable names after the owner selects **Connect**. It neither requests nor stores credentials.

## Run locally

The public interface lives in `public/` and is dependency-free HTML, CSS, and browser JavaScript. Vercel Functions in `api/` provide server-side validation, secure session cookies, and Supabase access.

```sh
npm test
npm run check
vercel dev
```

Copy `.env.example` to `.env.local` before local API testing. Never commit `.env.local`, database passwords, secret keys, access tokens, or service-role credentials.

## Provider setup

Create Love & Sunshine-owned accounts directly with each provider before enabling an integration: Stripe, Resend, Google Cloud, Microsoft Entra, Cloudflare, and optionally OpenAI. Add real values only to an untracked `.env.local` file after the application is moved to a server-backed implementation.

### Current hosted services

- Vercel: the website and API deploy under the `l-s-website-build` project.
- Supabase: project `vqmosxcwpkdquvrwspvk` stores public inquiries and workspace records. The schema migrations are in `supabase/migrations/`.
- Every exposed table has Row Level Security. Anonymous visitors may only create validated inquiries; signed-in team users must also have an active `profiles` record.
- Authentication tokens are stored in secure, HTTP-only cookies and never exposed to browser JavaScript.
- Stripe Billing supports one-time hosted invoices, finite installment plans, recurring retainers, customer records, payment history, and signature-verified webhook synchronization. Billing changes are limited to owner, admin, and finance roles.
- The production admin workspace is available at `https://loveandsunshinenash.com/admindashboard` and is excluded from search indexing.
- Outlook Calendar uses delegated Microsoft Graph authorization and supports GoDaddy-hosted Microsoft 365 work accounts. OAuth tokens are encrypted before storage and never exposed to the browser.

See `docs/INTEGRATION_SETUP.md` for the intended credentials and safeguards.
