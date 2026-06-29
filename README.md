# Holy Click

An incremental action RPG built with React, TypeScript, Vite, Tailwind CSS, and optional Supabase cloud accounts.

## Features

- Guest saves stored in the current browser.
- Encrypted device accounts that work immediately without cloud configuration.
- Secure email/password accounts with cross-browser cloud saves.
- English and Traditional Chinese interface switching.
- A random weapon drop every 100 real manual clicks; automation does not count.
- Weapon inventory, equipment, elemental enchantment, forging, and dungeon materials.
- A separate 9×9 tile dungeon controlled with WASD, arrow keys, or on-screen controls.
- Exponentially scaling enemies, floor rewards, run blessings, and permanent 1% blessing conversion on extraction.

## Public player login

Players do not need to upload files, import saves, edit configuration, or understand Supabase. In the public build, the account dialog only asks for a username/email and password.

- If no cloud backend is configured, the app uses an encrypted device account in the player's browser.
- If Supabase is configured by the site owner, the same dialog can offer cross-browser cloud sync.
- Never ask players for service keys, database passwords, `.env` files, or manual save files.

## Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

## Secure cloud account setup

Static GitHub Pages cannot securely implement its own password database. Holy Click uses Supabase Auth, which hashes passwords and issues secure sessions. Game saves use PostgreSQL row-level security, so players can only read and write their own row.

Without Supabase variables, the login dialog automatically offers device accounts. Device saves are encrypted with a password-derived PBKDF2 key and AES-GCM. They are intentionally locked to the same browser and cannot provide cross-browser sync.

1. Create a Supabase project.
2. Open the SQL editor and run [`supabase-schema.sql`](./supabase-schema.sql).
3. Copy `.env.example` to `.env.local`.
4. Add the project URL and public anon key.
5. In Supabase Authentication URL settings, add your local URL and GitHub Pages URL.

The anon key is designed to be public. Never place a Supabase service-role key or database password in this frontend repository.

Base64 is not encryption and is intentionally not used for passwords or save security.

## GitHub Pages

The included workflow builds and deploys the site. Add these repository secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then enable GitHub Pages with **GitHub Actions** as the source.

## Checks

```bash
npm run lint
npm run build
```
