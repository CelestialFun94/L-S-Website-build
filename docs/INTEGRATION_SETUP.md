# Integration setup — Love & Sunshine

## Connected foundation

| Service | Purpose | Configuration |
| --- | --- | --- |
| GitHub | Source control and change history | Repository access is authenticated through GitHub CLI; no token is committed |
| Vercel | Public website and server-side API hosting | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Supabase | Postgres database, Row Level Security, and team authentication | Schema tracked in `supabase/migrations/` |

The Supabase publishable key is intentionally safe for public clients, but this application still routes writes through Vercel so requests can be validated and abuse controls can be extended. Never add a service-role key to browser code.

## Team account setup

1. Create each team member in **Supabase → Authentication → Users** using an owner-approved business email.
2. Add the new user's UUID to `public.profiles` with an appropriate role: `owner`, `admin`, `operations`, `finance`, or `read_only`.
3. Keep `active = true` only while the person should have workspace access.
4. Team members sign in through **Team sign in** on the public site. The API stores access and refresh tokens in secure, HTTP-only cookies.

An Auth user without a matching active profile cannot enter the workspace.

## Connect only when ready

Create each account in the business owner’s name, with a Love & Sunshine-owned email address. Never paste secrets into documentation, chat, source control, or public website forms.

| Service | Purpose | Protected environment values |
| --- | --- | --- |
| Stripe | Invoices and payment links | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Resend | Transactional acknowledgement and billing email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Google Cloud | Google Calendar availability OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Microsoft Entra | Microsoft 365 / Outlook availability OAuth | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| Private object storage | Artist and project files | Provider-specific private bucket credentials |

Confirm the legal business name, domain, public email, invoice terms, internal roles, and privacy/terms language before enabling payments, email, calendar booking, or private client files.
