# @dariomvg/create

**Add Auth, AI, Payments, and Email to your Next.js App Router project — in minutes, not days.**

`create` is an interactive CLI that scaffolds production-ready integrations into an existing Next.js project. Pick a module, pick the features you need, pick a provider for each one — the CLI copies the code, installs the right dependencies, and syncs your `.env.local`. It also adds instruction files so AI agents and chat assistants can build your UI on top of what was installed.

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

Then it copies the code into `lib/`, installs only the dependencies you actually need, and merges any new environment variables into `.env.local` — without ever touching a secret you already set. At the end it adds `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` to your project root (see [Build with AI agents and chat](#build-with-ai-agents-and-chat)).

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
◆  AGENTS.md created.
◆  CLAUDE.md created.
◆  GEMINI.md created.
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

## Build with AI agents and chat

The CLI installs the integration code — it does not build your interface. That's where an AI assistant comes in: after the run, your project root contains three instruction files that tell an agent (or a chat assistant) how everything is organized, so it can build the UI or wire the installed code into the UI you already have.

| File | What it is | Read by |
|---|---|---|
| `AGENTS.md` | The main file: architecture, the full module/feature/provider catalog, the route handlers the CLI creates, and rules for working with the installed code | Agents that follow the [AGENTS.md convention](https://agents.md) (e.g. Cursor, Codex) |
| `CLAUDE.md` | A short file that imports `AGENTS.md`, so nothing is duplicated | Claude Code |
| `GEMINI.md` | A short file that points to `AGENTS.md` | Gemini CLI |

Only `AGENTS.md` holds content; the other two just point to it, so there is a single file to keep up to date.

### With a coding agent

Open your project with Claude Code, Cursor, Codex, Gemini CLI, or any agent that reads these files — they are picked up automatically. Then just ask for what you want:

```
Build a login page using the Clerk basic-auth integration that's already installed.
```

The agent is instructed to read the `SETUP.md` of each feature first (every feature folder has one), call only the functions that are actually exported, and reuse your existing components instead of inventing new ones.

### With a chat assistant

Chat assistants can't read your files, so give them the context yourself: attach or paste `AGENTS.md`, plus the `SETUP.md` of the feature you're working on, and then describe what you want.

```
Here are AGENTS.md and lib/payments/stripe/subscriptions/SETUP.md.
Build a pricing page with a "Subscribe" button wired to the installed code.
```

### If you already have these files

Nothing is overwritten. If `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md` already exists, the CLI appends its block at the end, between comment markers (`<!-- rise:agents:start -->` … `<!-- rise:agents:end -->`). Running the CLI again won't duplicate it, and `CLAUDE.md` / `GEMINI.md` are left untouched if they already point to `AGENTS.md`.

---

## Where things go

```
lib/<module>/<provider>/            ← shared code for that module + provider
lib/<module>/<provider>/<feature>/  ← code specific to one feature (+ a SETUP.md)
```

A few files don't follow that rule, on purpose:

- **`proxy.ts`** — Next.js only supports one. It's copied straight into your project root (or `src/`, if you use one). If you already have one from a previous run, the CLI asks before overwriting it — you can't run two auth providers' session logic at the same time.
- **`.env.local`** — never overwritten. New keys from a provider's `.env.example` are appended; anything you already set stays untouched.
- **`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`** — always in your project root, never inside `src/`. Never overwritten: the CLI adds its block to the end if the file already exists.
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

**Will it overwrite my existing `AGENTS.md` or `CLAUDE.md`?**
No. It appends its block to the end of the file and leaves everything you wrote untouched. If the block is already there from a previous run, it's skipped.

**Do I need an AI agent to use this?**
No. The code works the same either way; the instruction files only help an AI assistant that you choose to use. You can ignore or delete them.

**Does this work outside the App Router?**
Not currently — templates assume `app/` (or `src/app/`) route conventions.

---

## Links 

- [formaui.site](https://www.formaui.site) — docs, templates, and more 
- [Report an issue](https://github.com/dariomvg/create/issues) 


## License

MIT © [Dario](https://github.com/dariomvg)