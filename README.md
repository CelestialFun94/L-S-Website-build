# Love & Sunshine

An original public website and secure admin workspace for Love & Sunshine, an artist-development and songwriting practice.

## What is included

- Responsive public site, guided artist-start path, and co-writing inquiry flow.
- A Supabase-backed team workspace for artists, projects, songs/splits, billing, inquiries, and integration setup.
- A tracked `public/images` library for approved public website imagery, including the supplied Love & Sunshine brand sources.
- Integration setup UI that only prompts for a provider's required environment-variable names after the owner selects **Connect**. It neither requests nor stores credentials.

## Run locally

The public interface is dependency-free HTML, CSS, and browser JavaScript. Vercel Functions in `api/` provide server-side validation, secure session cookies, and Supabase access.

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
- Supabase: the `love-and-sunshine` project stores public inquiries and workspace records. The schema migration is in `supabase/migrations/`.
- Every exposed table has Row Level Security. Anonymous visitors may only create validated inquiries; signed-in team users must also have an active `profiles` record.
- Authentication tokens are stored in secure, HTTP-only cookies and never exposed to browser JavaScript.

See `docs/INTEGRATION_SETUP.md` for the intended credentials and safeguards.
