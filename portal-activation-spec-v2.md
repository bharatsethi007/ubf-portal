# UBF Portal — Staff Activation Flow (Build Spec, v2)

Supersedes portal-activation-spec.md. Two changes from v1, per Bharat:
1. **No Supabase emails.** Supabase's own auth email (from a supabase.co URL) is NOT used. No inviteUserByEmail, no magic-link email.
2. **Staff-generated link, copy-paste handover.** Staff activate a customer, the system returns a **set-password link on the UBF portal domain**, staff copies it and sends it to the customer however they like (their own email, WhatsApp, etc.). Customer clicks → sets their own password → logs in.

Follows portal-design-system.md for portal-side UI. Security rules from v1 still apply (service_role only in Edge Functions, verify caller is staff, never write portal_users from client, verify_jwt=true).

## The flow
1. Staff open a customer profile → "Portal access" → Activate → pick/enter the customer's email.
2. Backend creates the auth user (NO password, NO Supabase email) + a one-time set-password token.
3. Backend returns a link on OUR domain: `https://<portal>/portal/set-password?token=<token>`.
4. Staff copies the link (copy button) and sends it to the customer themselves.
5. Customer opens link → sets their own password → lands on the portal.
6. Link is single-use and expires (e.g. 7 days). Staff can regenerate if it lapses.

No password ever set or seen by staff. No Supabase-branded email. Fully under UBF's domain and control.

## 1. Migration — `portal_users` + token table
Extend `portal_users` (all nullable/defaults):
```
status        text not null default 'pending'   -- 'pending' | 'active' | 'revoked'
invited_by    uuid
activated_at  timestamptz
last_login_at timestamptz
display_name  text
```
(`status` starts 'pending' until the customer sets a password, then 'active'.)

New table `portal_invite_tokens`:
```
token        text primary key          -- long random (e.g. 32+ bytes base64url)
user_id      uuid not null
account_id   text not null
expires_at   timestamptz not null
used_at      timestamptz               -- null until consumed
created_by    uuid
created_at    timestamptz default now()
```
Store only the token hash if you want extra safety (hash on create, compare hash on redeem). RLS: no client access to this table at all — only Edge Functions (service_role).

## 2. Edge Function: `portal-activate` (verify_jwt=true, staff)
Input `{ account_id, email, display_name? }`.
1. Verify caller is staff.
2. Normalise email. Look up existing auth user by email:
   - Not found → `admin.createUser({ email, email_confirm: true })` **with no password** (or a random throwaway that's never shared).
   - Found → reuse user_id.
3. Guard: if a portal_users row already exists and is 'active', return "already active" (offer regenerate-link instead). If 'pending'/'revoked', allow re-activation.
4. Upsert portal_users `{ user_id, account_id, email, display_name, status: 'pending', invited_by: caller, activated_at: null }`.
5. Generate a random token, insert into `portal_invite_tokens` with `expires_at = now() + 7 days`.
6. Return `{ ok: true, link: "https://<portal-domain>/portal/set-password?token=<token>", expires_at }`.
   - Portal domain from an env var (the Netlify site URL), NOT hardcoded.

## 3. Edge Function: `portal-redeem-token` (PUBLIC — no auth, but token IS the auth)
This is what the customer's link calls. Input `{ token, password }`.
1. Look up token (or its hash). Reject if not found, expired, or already used.
2. Set the auth user's password: `admin.updateUserById(user_id, { password })`.
3. Mark token `used_at = now()`.
4. Set portal_users `status = 'active'`, `activated_at = now()`.
5. Return `{ ok: true, email }` so the frontend can sign the user in.
- Rate-limit / brute-force guard: token is long+random and single-use; reject repeated bad attempts.

## 4. Edge Function: `portal-regenerate-link` (verify_jwt=true, staff)
Input `{ user_id }`. Verify staff → invalidate old unused tokens for that user → issue a fresh token → return new link. For when a link expires or the customer loses it.

## 5. Edge Function: `portal-revoke-user` (verify_jwt=true, staff)
Input `{ user_id, revoke: bool }`. Set status 'revoked' / 'active'. Revoked → denied at gate.

## 6. Staff UI — "Portal access" on customer profile (staff app style)
- List portal users for the account: email, status pill (Pending / Active / Revoked), activated date, last login.
- **Activate** button → modal: email (dropdown of account contacts + free-type), optional display name → calls `portal-activate`.
  - On success: show the **set-password link** with a big **Copy link** button and "Send this to the customer. Expires in 7 days." No password shown (there isn't one).
- Per user: **Copy link / Regenerate link** (if pending or expired), **Revoke / Reactivate**.
- Empty state: "No portal access yet. Activate to give this customer online tracking."

## 7. Portal — set-password page (portal theme)
- Route `/portal/set-password?token=…` — PUBLIC (no auth gate; the token authorises).
- `SetPasswordPage`: reads token from URL, shows new-password + confirm. On submit → `portal-redeem-token`. On success → `supabase.auth.signInWithPassword` (email returned) → redirect `/portal`.
- Invalid/expired/used token → clear message: "This link has expired or was already used. Contact UB Freight for a new one." No detail leakage.

## 8. Gate changes
- `PortalAuthGate`: require portal_users row AND `status = 'active'`. 'pending' with no session → they haven't set a password yet (shouldn't have a session); 'revoked' → denied card.
- Update `last_login_at` on dashboard load (safe RPC scoped to own row).

## Build order
1. Migration (portal_users columns + portal_invite_tokens + RLS). Show Bharat before applying.
2. `portal-activate` + `portal-redeem-token` (the core pair).
3. Staff UI activation modal + link copy + user list.
4. Portal `SetPasswordPage` (public route).
5. `portal-regenerate-link`, `portal-revoke-user`, gate status check.

## Verify before building
- Report what `invite-portal-user` currently does (extend vs replace).
- Confirm `staff_users` is the correct staff check (auth.uid()).
- Confirm the portal domain env var to build links from.
- Show the migration + RLS before applying.

## Non-negotiables
- No Supabase-branded emails. Links are on the UBF portal domain, handed over by staff.
- Tokens: long, random, single-use, expiring. No client access to the token table.
- service_role only in Edge Functions. Every staff function verifies staff first.
- portal_users / tokens never written from the client.
