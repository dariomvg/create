# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
 
## [0.2.0] - 2026-10-08
 
### Added
 
- AI instruction files: after a successful run, the CLI now copies `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` into the root of your project, so AI assistants and coding agents understand the structure of what was installed.
- `AGENTS.md` documents the `lib/<module>/<provider>/<feature>` architecture, the full module/feature/provider catalog, the route handlers the CLI creates, and rules for working with the installed code. `CLAUDE.md` and `GEMINI.md` import it instead of duplicating its content.
- Existing files are never overwritten: if you already have one of these files, the CLI appends its block at the end. Running the CLI again does not duplicate it, and `CLAUDE.md` / `GEMINI.md` are left alone if they already point to `AGENTS.md`.

## [0.1.2] - 2026-09-19

### Added

- `Demo GIF` in the README showing the CLI in action.

## [0.1.1] - 2026-09-17

### Added

- `LICENSE` file (MIT).
- `repository` field in `package.json`, linking to the GitHub repo.
- `CHANGELOG.md` is now included in the published package, so it shows up as a "Changelog" tab on npm.

### Fixed

- `publishConfig.access` set to `public` — without it, `npm publish` fails on a scoped package like `@dariomvg/create` unless you pass `--access public` manually every time.

## [0.1.0] - 2026-09-16

### Added

- Initial release of `@dariomvg/create`, successor to [`@dariomvg/formaui`](https://www.npmjs.com/package/@dariomvg/formaui).
- New module → feature → provider model: a provider now declares which specific features of a module it supports, instead of covering the whole module or nothing.
- **Auth** module: Clerk, Auth0, and Supabase — basic auth, authorization, organizations, and user management.
- **AI** module: Anthropic, OpenAI, and the Vercel AI SDK (Gemini) — text generation, chat, and tool calling.
- **Payments** module: Stripe, Mercado Pago, and Lemon Squeezy — one-time payments, subscriptions, and (Stripe only) billing management.
- **Email** module: Resend — sending, transactional templates, and webhooks.
- A single feature can now be installed with more than one provider in the same run (e.g. basic auth with both Clerk and Supabase).
- Automatic `.env.local` sync: new keys from a provider's `.env.example` are appended without ever overwriting a value you already set.

[Unreleased]: https://github.com/dariomvg/create/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/dariomvg/create/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dariomvg/create/releases/tag/v0.1.0