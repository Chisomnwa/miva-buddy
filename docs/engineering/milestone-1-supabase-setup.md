# Milestone 1 Supabase setup

Milestone 1 uses a hosted Supabase project. Docker and local Supabase are not required.

## Application environment

Set these values in the ignored local `.env.local` file:

- `NEXT_PUBLIC_SUPABASE_URL`: Project URL from Supabase Project Settings → API.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key from the same page. This is designed for client applications and is safe to expose only alongside correct RLS and grants.

`DATABASE_URL` is optional for normal app runtime. It is only needed if running Drizzle migrations from this repository. The SQL migration can instead be applied in the Supabase Dashboard SQL Editor, so no database password needs to be shared with Codex.

Never put a database connection string, Supabase secret/service-role key, or other privileged credential in a `NEXT_PUBLIC_` variable or browser bundle.

## Required dashboard configuration

1. Allow new user signups globally and enable anonymous sign-ins under Authentication settings. These controls are separate.
2. For a dedicated Miva Buddy project, disable the Email provider/password sign-in because the MVP has no email-auth flow. Email confirmation, SMTP, password reset, and auth callback URLs are not used.
3. Apply `drizzle/0000_profiles.sql` to the hosted development project's database before testing onboarding persistence.
4. Keep RLS enabled. Profile policies grant access to the authenticated role only when `auth.uid() = user_id`. Supabase anonymous users use the authenticated database role and carry their own user ID.

Anonymous sessions are browser-bound. Clearing site data or changing devices loses access to that anonymous identity and its data. No cross-device recovery is promised in the MVP.

Supabase recommends CAPTCHA protection for anonymous sign-in endpoints to reduce automated account creation. It is not needed to validate the local capstone flow, but configure an invisible CAPTCHA/Turnstile integration or equivalent abuse protection before exposing a public deployment to untrusted traffic.

The hosted end-to-end tests that create anonymous users are opt-in via `RUN_HOSTED_SUPABASE_TESTS=1` and run only in Chromium. Repeated test runs create persistent anonymous Auth records and count against Supabase's per-IP anonymous sign-in rate limit (30 requests per hour by default); allow the limit window to reset before retrying after a rate-limit response. See [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## Milestone 1 configuration verified

- Project URL and publishable key configured locally.
- Global signup and anonymous sign-ins enabled; the email/password provider remains disabled.
- The profile migration applied and RLS verified.

If the migration should be applied by `npm run db:migrate` instead of Dashboard SQL Editor, configure a direct PostgreSQL `DATABASE_URL` locally. Do not send its password in chat. If replacing the hosted project, rerun the hosted integration checks before relying on its identity, persistence, or RLS configuration.
