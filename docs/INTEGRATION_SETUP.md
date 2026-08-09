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
4. Team members sign in at `https://loveandsunshinenash.com/admindashboard`. The API stores access and refresh tokens in secure, HTTP-only cookies.

An Auth user without a matching active profile cannot enter the workspace.

## Connect only when ready

Create each account in the business owner’s name, with a Love & Sunshine-owned email address. Never paste secrets into documentation, chat, source control, or public website forms.

| Service | Purpose | Protected environment values |
| --- | --- | --- |
| Stripe | Hosted invoices, finite payment plans, recurring retainers, portal links, and signed event synchronization | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Resend | Transactional acknowledgement and billing email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Google Cloud | Google Calendar availability OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Microsoft Entra | Microsoft 365 / Outlook availability OAuth | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| Private object storage | Artist and project files | Provider-specific private bucket credentials |
| OpenAI | Controlled Sunshine Operator tools after permissions and budget approval | `OPENAI_API_KEY` and server-only model configuration |
| External password manager | Secure credential storage; the dashboard stores references only | No password-manager secrets are stored in this application |

Confirm the legal business name, domain, public email, invoice terms, internal roles, and privacy/terms language before enabling payments, email, calendar booking, or private client files.

## Stripe billing

- The production webhook URL is `https://loveandsunshinenash.com/api/stripe-webhook` after custom-domain DNS finishes propagating. Until then, use `https://l-s-website-build.vercel.app/api/stripe-webhook`.
- Subscribe the account webhook to: `checkout.session.completed`, `invoice.finalized`, `invoice.sent`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.succeeded`, `charge.refunded`, `subscription_schedule.completed`, `subscription_schedule.canceled`, and `subscription_schedule.aborted`.
- The webhook verifies the raw request with `STRIPE_WEBHOOK_SECRET` before changing any data. Event IDs are recorded so Stripe retries are idempotent.
- Keep the live Stripe resource connected only to Production. Preview and Development receive no Stripe secret unless a separate sandbox is deliberately connected later. Never create test charges in the live account.
- `SUPABASE_SECRET_KEY` is server-only and lets signed Stripe events synchronize billing rows while all browser access remains protected by Row Level Security.
