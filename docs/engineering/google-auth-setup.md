# Google Auth setup

Miva Buddy's beta entry flow uses Google OAuth through Supabase Auth with PKCE. This guide describes required manual configuration; repository changes alone do not configure either hosted Supabase project or create Google credentials.

## Local Supabase

1. In Google Cloud Console, configure an OAuth client for the local Supabase Auth callback: `http://127.0.0.1:54321/auth/v1/callback` (use the exact callback shown by the running local Supabase Auth service if its ports differ).
2. Supply `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` to the local Supabase CLI environment. Do not put the secret in a `NEXT_PUBLIC_` variable or source control. `supabase/config.toml` references these names through Supabase CLI `env(...)` interpolation.
3. Restart the local stack only when explicitly testing the configured provider. The application redirect allowlist includes `http://localhost:3000/auth/callback` and `http://127.0.0.1:3000/auth/callback`; the app callback exchanges the PKCE code and chooses `/onboarding` or `/home` from the signed-in user's profile.
4. Keep anonymous sign-ins disabled and the Email Auth provider disabled. Global signup remains enabled so a first-time Google user can be created.

## Hosted project setup (not performed)

For each approved hosted project, configure its own Google OAuth client and Supabase Auth provider credentials. The Google client must allow that project's Supabase Auth callback URI. In Supabase Auth, set the production Site URL and narrowly allow the exact application callback URL, for example `https://<approved-app-domain>/auth/callback`; do not use wildcard redirects. Disable anonymous sign-ins and the Email provider, and enable Google. Apply the reviewed database migration through the separate approved migration process before accepting student traffic.

No hosted project settings, OAuth client, credentials, or database migrations were changed as part of this implementation.

## Session and legacy identity behavior

The callback accepts only a Supabase Auth user whose verified `is_anonymous` field is explicitly `false`. Email addresses and user-editable metadata are not used to establish identity. Existing anonymous test accounts and their rows remain untouched and are not linked to Google accounts; after migration 0011 is applied, restrictive RLS policies deny those anonymous JWTs access to user-owned tables and the course-materials bucket. Sign-out clears the current browser's local Supabase session.

See [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls), and [local config secrets](https://supabase.com/docs/guides/local-development/managing-config).
