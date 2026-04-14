# Instagram Linking (Dev Client) — Backend Spec

This document describes the backend contract required for the mobile app onboarding step **Link Instagram** (`/(auth)/link-instagram`) using **Instagram API with Instagram Login** (Business Login).

It is written to be implementable as-is by backend, and matches the mobile client’s expectations.

## Goals

- Link an **Instagram professional account** (Business or Creator/`Media_Creator`) to the current app user.
- Obtain an **Instagram User Access Token** server-side.
- Exchange short-lived (1h) → long-lived (60d) token.
- Refresh long-lived token as needed.
- Return a minimal **profile summary** so the app can show “Connected” immediately.

## Non-goals / constraints

- We do **not** fetch “poll vote results” via API (Instagram does not provide generic access to Story poll vote details for this use case).
- We do **not** store app secrets on device. All token exchange & refresh is server-side.

---

## OAuth Overview (what the app does)

1. App opens:

`GET https://www.instagram.com/oauth/authorize?...`

with:
- `client_id=<INSTAGRAM_APP_ID>`
- `redirect_uri=<APP_DEEPLINK_REDIRECT_URI>`
- `response_type=code`
- `scope=instagram_basic` (minimum to read profile + media)
- `state=<random>`

2. Instagram redirects to `redirect_uri`:
- Success: `?code=<AUTH_CODE>#_`
- Cancel: `?error=access_denied&error_reason=user_denied&error_description=...`

3. App calls backend `POST /auth/instagram/complete` with the `code`, `redirectUri`, and `state`.

Backend exchanges `code` → token and returns profile summary.

---

## Mobile required configuration

### Redirect URI format (dev-client)

Expo scheme is set to `askmi` in `app.json`, and the app uses:

- `redirectUri = askmi://instagram-auth`

Backend must treat `redirectUri` as an allow-listed value (do not accept arbitrary redirect URIs).

### Required client config keys

Mobile expects these in `app.json`:

- `expo.extra.apiBaseUrl` — base URL for backend, e.g. `https://api.example.com`
- `expo.extra.instagramAppId` — Instagram App ID (NOT secret)

---

## Backend endpoints

### 1) Complete link

**POST** `/auth/instagram/complete`

Exchanges the Instagram authorization code for tokens, stores them, then fetches profile summary.

#### Auth
- Must be called by an already authenticated app user (bearer token/session/cookie).

#### Request body

```json
{
  "code": "AQBx-hBsH3...",
  "redirectUri": "askmi://instagram-auth",
  "state": "a1b2c3..."
}
```

#### Backend processing (required)

1) Exchange `code` for short-lived token

`POST https://api.instagram.com/oauth/access_token`

Form fields:
- `client_id`
- `client_secret`
- `grant_type=authorization_code`
- `redirect_uri` (must exactly match)
- `code`

Expected response contains:
- `access_token` (short-lived)
- `user_id` (Instagram-scoped user ID)
- `permissions` (comma-separated)

2) Exchange short-lived token for long-lived token (server-side)

`GET https://graph.instagram.com/access_token`

Query:
- `grant_type=ig_exchange_token`
- `client_secret=<APP_SECRET>`
- `access_token=<SHORT_LIVED_TOKEN>`

Expected response:
- `access_token` (long-lived)
- `expires_in` (seconds, ~60 days)

3) Fetch profile summary

`GET https://graph.instagram.com/v25.0/me?fields=user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count&access_token=<LONG_LIVED_TOKEN>`

> Field availability: `account_type` can be `Business` or `Media_Creator`.

4) Persist in backend DB (recommended fields)

Store at minimum:
- `instagram.ig_user_id`
- `instagram.username`
- `instagram.long_lived_access_token` (encrypted at rest)
- `instagram.expires_at` (computed)
- `instagram.scopes_granted` (string list)
- `instagram.linked_at`

Optionally store cached profile fields for quick UI:
- `name`, `profile_picture_url`
- `followers_count`, `follows_count`, `media_count`

#### Response (required by mobile)

```json
{
  "linked": true,
  "profile": {
    "igUserId": "1234567890",
    "username": "creator_handle",
    "name": "Creator Name",
    "accountType": "Media_Creator",
    "profilePictureUrl": "https://...",
    "followersCount": 12500,
    "followsCount": 3200,
    "mediaCount": 87
  }
}
```

#### Error responses

- `401/403` if app user is not authenticated
- `400` for invalid `code` / mismatched `redirectUri` / invalid request
- `409` if Instagram account is already linked to another app user (recommended)
- `5xx` for upstream errors

Payload suggestion:

```json
{
  "error": "instagram_oauth_failed",
  "message": "Matching code was not found or was already used"
}
```

Mobile will show `message` if present.

---

### 2) Refresh token (server scheduled / on-demand)

**GET** `https://graph.instagram.com/refresh_access_token`

Query:
- `grant_type=ig_refresh_token`
- `access_token=<LONG_LIVED_TOKEN>`

Refresh rules (per Meta docs):
- token must be valid (not expired)
- token must be at least 24h old
- user granted baseline permission (typically `instagram_business_basic` for Business Login)

Backend should refresh:
- on a schedule (e.g. daily) for all linked users
- or opportunistically when \(expires\_at < 7 days\)

---

## Scopes / permissions strategy

### MVP (to satisfy current app UI + basic media access)
- `instagram_basic`

This supports:
- profile fields (`username`, `name`, `profile_picture_url`)
- follower/following counts (as available in `/me` fields)
- media list access

### “Everything” (future features)
If you intend to do publishing, comments, or messaging later, request these only when needed (app review impact):
- `instagram_business_basic`
- `instagram_business_content_publish`
- `instagram_business_manage_comments`
- `instagram_business_manage_messages`
- plus insights-related permissions for analytics use cases

> Requesting more scopes increases review burden. Consider progressive authorization.

---

## Security requirements

- Never send `client_secret` to mobile.
- Encrypt stored long-lived access tokens.
- Ensure `redirectUri` is allow-listed and matches the one used in OAuth.
- Validate `state` for CSRF protection (mobile generates it; backend should store/verify if you also initiate OAuth server-side).

---

## Mobile integration notes (what mobile expects)

After `/auth/instagram/complete` succeeds, mobile will update local user state:
- `hasLinkedInstagram = true`
- `instagramUsername`, `instagramUserId`
- `avatar` from `profilePictureUrl`
- `followers`, `following` as strings

Then it navigates to:
- `/(auth)/verify-poll` (current onboarding step)

