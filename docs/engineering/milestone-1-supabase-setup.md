# Milestone 1 Supabase setup

Milestone 1 uses a hosted Supabase project. Docker and local Supabase are not required.

## Application environment

Set these values in the ignored local `.env.local` file:

- `NEXT_PUBLIC_SUPABASE_URL`: Project URL from Supabase Project Settings → API.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key from the same page. This is designed for client applications and is safe to expose only alongside correct RLS and grants.

`DATABASE_URL` is optional for normal app runtime. It is only needed if running Drizzle migrations from this repository. The SQL migration can instead be applied in the Supabase Dashboard SQL Editor, so no database password needs to be shared with Codex.

Never put a database connection string, Supabase secret/service-role key, or other privileged credential in a `NEXT_PUBLIC_` variable or browser bundle.

## Required dashboard configuration

1. The original anonymous-first setup instructions are superseded. For the Google-auth beta, disable anonymous sign-ins, leave global sign-up enabled for Google OAuth, and disable the Email provider. These are separate controls.
2. Configure the Google provider with a Google OAuth client, the Supabase Auth callback URI, and the application's `/auth/callback` redirect allowlist. See [Google Auth setup](google-auth-setup.md). Do not place the Google client secret in browser-visible configuration.
3. Apply `drizzle/0000_profiles.sql` to the hosted development project's database before testing onboarding persistence.
4. Keep RLS enabled. Existing owner policies continue to require `auth.uid() = user_id`. Supabase anonymous Auth users also assume the `authenticated` database role, so migration 0011 adds restrictive `is_anonymous = false` checks without replacing owner isolation.

Existing anonymous development identities and rows are preserved, not linked or deleted. The application rejects them, and migration 0011 denies their access to user-owned tables and the private course-materials bucket. Do not apply that migration to a hosted project without the normal separate migration approval and backup process.

Review Supabase Auth rate limits and Google OAuth abuse protections before public release. The former anonymous-auth CAPTCHA guidance does not configure Google provider protections.

Legacy browser tests that create anonymous users do not verify the Google-auth flow and are not a valid auth test path. A dedicated permanent-user test fixture remains future work; do not enable old hosted identity tests against a project configured for this beta.

## Milestone 1 configuration verified

- Project URL and publishable key configured locally.
- Anonymous sign-ins disabled; global signup enabled for Google OAuth; email/password provider disabled.
- The profile migration applied and RLS verified.

If the migration should be applied by `npm run db:migrate` instead of Dashboard SQL Editor, configure a direct PostgreSQL `DATABASE_URL` locally. Do not send its password in chat. If replacing the hosted project, rerun the hosted integration checks before relying on its identity, persistence, or RLS configuration.
