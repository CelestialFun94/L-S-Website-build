# Integration setup — Love & Sunshine

This prototype deliberately has no backend, authentication, database, email sender, payment processor, calendar connection, file bucket, or secret store. It must not be used to process real artist data or payments.

## Connect only when ready

Create each account in the business owner’s name, with a Love & Sunshine-owned email address. Never paste secrets into documentation, chat, source control, or browser forms.

| Service | Purpose | Values to configure in a future `.env.local` |
| --- | --- | --- |
| Stripe | Test-mode invoices and payment links | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Resend | Transactional acknowledgement and billing email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Google Cloud | Google Calendar availability OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Microsoft Entra | Microsoft 365 / Outlook availability OAuth | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| Cloudflare R2 | Private file storage | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| OpenAI (optional) | Approval-gated AI operator | `OPENAI_API_KEY` |

## Important next implementation decisions

1. Select production authentication (for example, Supabase Auth or Auth.js) before team sign-in is enabled.
2. Confirm the legal business name, domain, public email, tax policy, invoice terms, internal roles, and privacy/terms language.
3. Choose whether “Chase” means merchant processing, bank reconciliation, manual payments, or a supported aggregation/import. Do not assume a Chase API.
4. Build a server-side database and authorization layer before handling production client data, files, calendar tokens, payment details, or public form submissions.
