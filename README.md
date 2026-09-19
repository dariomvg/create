# @dariomvg/create

**Add Auth, AI, Payments, and Email to your Next.js App Router project — in minutes, not days.**

`create` is an interactive CLI that scaffolds production-ready integrations into an existing Next.js project. Pick a module, pick the features you need, pick a provider for each one — the CLI copies the code, installs the right dependencies, and syncs your `.env.local`.

[![npm version](https://img.shields.io/npm/v/%40dariomvg%2Fcreate.svg)](https://www.npmjs.com/package/@dariomvg/create)
[![license](https://img.shields.io/npm/l/%40dariomvg%2Fcreate.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/%40dariomvg%2Fcreate.svg)](https://nodejs.org)

---

<img src="https://res.cloudinary.com/duyiov4s1/image/upload/v1789823494/video-demo-cli-dariomvg-create.gif" />

---


## Quick start

Run it from the root of an existing Next.js App Router project:

```bash
bunx @dariomvg/create@latest
```

Or with your package manager of choice:

```bash
npx @dariomvg/create@latest
pnpm dlx @dariomvg/create@latest
yarn dlx @dariomvg/create@latest
```

No install, no config file — just answer the prompts.

---

## What it does

For each module, `create` asks:

1. **Do you want to integrate `<Module>`?** — a simple yes/no.
2. **Which features do you want?** — pick one or more from that module's catalog.
3. **Which provider(s)?** — for each feature you picked, choose from the providers that support it. You can pick more than one (e.g. `basic-auth` with both Clerk **and** Supabase in the same run).

Then it copies the code into `lib/`, installs only the dependencies you actually need, and merges any new environment variables into `.env.local` — without ever touching a secret you already set.

```
◆  Auth
│
◇  Do you want to integrate Auth?
│  Yes
│
◇  Auth: select the features you want to integrate
│  Basic auth, Organizations
│
◇  Basic auth: select provider(s)
│  Clerk
│
◇  Organizations: select provider(s)
│  Clerk
│
◇  Clerk — basic-auth
◆  Files copied to lib/auth/clerk/
◆  Files copied to lib/auth/clerk/basic-auth/
◇  Dependencies installed: @clerk/nextjs
◇  Variables added to .env.local (from clerk/common/.env.example)
│
◇  Clerk — organizations
◆  Files copied to lib/auth/clerk/organizations/
│
✨ Ready! Before starting, review these files:

  → lib/auth/clerk/basic-auth/SETUP.md
  → lib/auth/clerk/organizations/SETUP.md

Visit https://www.formaui.site for more information.
✨Thanks, and happy building!✨
```

---

## Modules, features & providers

| Module | Feature | Providers |
|---|---|---|
| **Auth** | Basic auth | Clerk, Auth0, Supabase |
| | Authorization | Clerk |
| | Organizations | Clerk, Auth0 |
| | User management | Supabase |
| **AI** | Text generation | Anthropic, OpenAI, Vercel AI SDK (Gemini) |
| | Chat | Anthropic, OpenAI, Vercel AI SDK (Gemini) |
| | Tool calling | Anthropic, OpenAI, Vercel AI SDK (Gemini) |
| **Payments** | One-time payments | Stripe, Mercado Pago, Lemon Squeezy |
| | Subscriptions | Stripe, Mercado Pago, Lemon Squeezy |
| | Billing management | Stripe |
| **Email** | Sending | Resend |
| | Transactional | Resend |
| | Webhooks | Resend |

A provider only shows up as an option for the features it actually supports — the CLI filters the list for you.

### Auth

- **Clerk** — `@clerk/nextjs`. Basic auth, authorization, and organizations.
- **Auth0** — `@auth0/nextjs-auth0`. Basic auth and organizations, Universal Login.
- **Supabase** — `@supabase/ssr` + `@supabase/supabase-js`. Basic auth (OAuth/PKCE) and self-service user management.

### AI

- **Anthropic** — `@anthropic-ai/sdk`. Text generation, multi-turn chat streaming, and tool calling.
- **OpenAI** — official `openai` SDK. Text generation, chat (with a separate audio/speech endpoint), and tool calling.
- **Vercel AI SDK (Gemini)** — `ai` + `@ai-sdk/google`. Same three features via the Vercel AI SDK.

### Payments

- **Stripe** — the only provider with all three features, including a full billing/customer-portal integration.
- **Mercado Pago** and **Lemon Squeezy** — one-time payments and subscriptions.

Each feature gets its own webhook route handler (e.g. `stripe-subscriptions` and `stripe-billing` are separate endpoints from the base `stripe` one).

### Email

- **Resend** + `@react-email/components`. Plain/HTML sending, prebuilt transactional templates (verification, password reset, welcome, invitations...), and signed webhook events (sent, delivered, bounced, opened, clicked).

---

## Where things go

```
lib/<module>/<provider>/            ← shared code for that module + provider
lib/<module>/<provider>/<feature>/  ← code specific to one feature (+ a SETUP.md)
```

A few files don't follow that rule, on purpose:

- **`proxy.ts`** — Next.js only supports one. It's copied straight into your project root (or `src/`, if you use one). If you already have one from a previous run, the CLI asks before overwriting it — you can't run two auth providers' session logic at the same time.
- **`.env.local`** — never overwritten. New keys from a provider's `.env.example` are appended; anything you already set stays untouched.
- **Route handlers** (webhooks, OAuth callbacks) — go straight to their real path under `app/api/...`, as declared by each feature.

---

## Requirements

- An existing Next.js project using the **App Router**
- Node.js 18+
- npm, pnpm, yarn, or bun — auto-detected from your lockfile (falls back to npm)

---

## FAQ

**Can I run the CLI more than once?**
Yes. It's safe to add more modules/features later — existing files are never overwritten without asking first, and `.env.local` only ever gains new keys.

**What if I pick two providers for the same feature?**
Their code lives side by side (`lib/auth/clerk/basic-auth/` and `lib/auth/supabase/basic-auth/` don't collide) — except `proxy.ts`, which is a single file. The second provider you configure will ask to overwrite it.

**Does this work outside the App Router?**
Not currently — templates assume `app/` (or `src/app/`) route conventions.

---

## Links 

- [formaui.site](https://www.formaui.site) — docs, templates, and more 
- [Report an issue](https://github.com/dariomvg/create/issues) 


## License

MIT © [Dario](https://github.com/dariomvg)