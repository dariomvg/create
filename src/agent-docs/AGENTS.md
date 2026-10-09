## Integrations installed with @dariomvg/create

This project uses `@dariomvg/create`, a CLI that copies ready-made integrations (Auth, AI, Payments, Email) into a Next.js App Router project. The CLI only **copies code, installs dependencies, and syncs `.env.local`**. It does not build any UI and does not wire the code into the app. That is your job: build the interface, or connect the existing one, to the code the CLI installed.

### How the code is organized

```
lib/<module>/<provider>/                 shared code for one provider (client, types)
lib/<module>/<provider>/<feature>/       code for one feature + its SETUP.md
proxy.ts                                 project root (or src/), belongs to ONE auth provider
app/api/...                              route handlers (webhooks, OAuth callbacks, streaming)
.env.local                               project root, never inside src/
```

If the project uses a `src/` directory, `lib/` and `app/` live inside it. `.env.local`, `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` always stay in the repository root.

Example: Clerk's `basic-auth` feature lives in `lib/auth/clerk/basic-auth/`. Supabase's lives in `lib/auth/supabase/basic-auth/`. The same feature can be installed with more than one provider, and the folders never collide.

Not every provider has every folder. Which ones exist depends on what the user chose when running the CLI, so check the filesystem before assuming something is installed.

### Catalog

| Module | Feature | Providers |
|---|---|---|
| auth | `basic-auth` | Clerk, Auth0, Supabase |
| auth | `authorization` | Clerk |
| auth | `organizations` | Clerk, Auth0 |
| auth | `user-management` | Supabase |
| ai | `text-generation` | Anthropic, OpenAI, Vercel AI SDK (Gemini) |
| ai | `chat` | Anthropic, OpenAI, Vercel AI SDK (Gemini) |
| ai | `tool-calling` | Anthropic, OpenAI, Vercel AI SDK (Gemini) |
| payments | `one-time` | Stripe, Mercado Pago, Lemon Squeezy |
| payments | `subscriptions` | Stripe, Mercado Pago, Lemon Squeezy |
| payments | `billing-management` | Stripe |
| email | `sending` | Resend |
| email | `transactional` | Resend |
| email | `webhooks` | Resend |

Provider folder names: `clerk`, `auth0`, `supabase`, `anthropic`, `openai`, `vercel-sdk` (Gemini through the Vercel AI SDK), `stripe`, `mercadopago`, `lemonsqueezy`, `resend`.

### Route handlers the CLI creates

These already exist when the feature is installed. Do not recreate them. Call them from the UI or point external services at them.

| Provider / feature | Route |
|---|---|
| Supabase `basic-auth` | `app/api/auth/callback/route.ts` (OAuth callback) |
| Stripe `one-time` | `app/api/webhooks/stripe/route.ts` |
| Stripe `subscriptions` | `app/api/webhooks/stripe-subscriptions/route.ts` |
| Stripe `billing-management` | `app/api/webhooks/stripe-billing/route.ts` |
| Mercado Pago `one-time` | `app/api/webhooks/mercadopago/route.ts` |
| Mercado Pago `subscriptions` | `app/api/webhooks/mercadopago-subscriptions/route.ts` |
| Lemon Squeezy `one-time` | `app/api/webhooks/lemonsqueezy/route.ts` |
| Lemon Squeezy `subscriptions` | `app/api/webhooks/lemonsqueezy-subscriptions/route.ts` |
| Resend `webhooks` | `app/api/webhooks/resend/route.ts` |
| Anthropic `text-generation` | `app/api/anthropic/stream/route.ts` |
| Anthropic `chat` | `app/api/anthropic/chat/stream/route.ts` |
| OpenAI `text-generation` | `app/api/openai/stream/route.ts` |
| OpenAI `chat` | `app/api/openai-chat/stream/route.ts` and `app/api/openai-chat/speech/route.ts` |
| Vercel AI SDK `text-generation` | `app/api/ai-sdk/stream/route.ts` |
| Vercel AI SDK `chat` | `app/api/ai-sdk/chat/stream/route.ts` |

Clerk and Auth0 have no route handlers of their own.

### Rules

1. **Read the feature's `SETUP.md` first.** Every feature folder has one (`lib/<module>/<provider>/<feature>/SETUP.md`). It lists the dependencies, the files, usage examples, and the manual setup steps. Read it before writing any code that touches that feature.
2. **Never invent function names or signatures.** Only call what the installed files actually export (usually `actions.ts` and `service.ts` in the feature folder). If you are unsure, open the file.
3. **Wire the code, do not reimplement it.** For example build the UI (forms, buttons, navbar links, pages) and connect it by calling the installed functions. Do not write a second version of something the CLI already installed.
4. **Respect the project's existing UI.** If the project already has components, a design system, or styling conventions, reuse them. Only build new UI from scratch when asked or when none exists.
5. **`proxy.ts` belongs to a single auth provider.** Next.js supports only one. Before touching auth behavior, check which provider the current `proxy.ts` was written for. Do not assume another provider's session logic applies.
6. **Never hardcode secrets.** Required variables are already added to `.env.local` as placeholders. Read them from `process.env` and tell the user which ones still need real values. Never commit `.env.local`.
7. **Keep server-only code on the server.** Provider SDKs, secret keys, and webhook verification belong in Server Actions, Route Handlers, or server components. Do not import them into client components.
8. **Do not edit installed files without a reason.** They are the baseline the user expects. If a change is needed, make it minimal and explain it.
9. **If something is not installed, say so.** Do not hand-roll an integration for a module/feature/provider the CLI offers. Tell the user to run `bunx @dariomvg/create@latest` and select it.
10. **Finish the manual steps.** Most providers need configuration in their own dashboard (API keys, webhook URLs, redirect URLs). Those steps are in `SETUP.md`. Remind the user instead of skipping them.
