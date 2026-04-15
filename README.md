# AskMI Backend API

Express/TypeScript API for the AskMI platform - campaign management, surveys, analytics, and user management.

## Tech Stack

- **Runtime:** Node.js, TypeScript
- **Framework:** Express 5
- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma 7 (with pg adapter)
- **Auth:** JWT, bcrypt
- **Validation:** Zod
- **Docs:** Swagger/OpenAPI

## Prerequisites

- Node.js 18+
- PostgreSQL database (or [Neon](https://neon.tech) for serverless)
- npm or pnpm

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# Optional
PORT=4000
CORS_ORIGIN=*
JWT_SECRET=your-jwt-secret-key
NODE_ENV=development

# Instagram OAuth (required for POST /api/auth/instagram)
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
# Must match the redirect_uri used in the Instagram authorize step exactly (per environment)
INSTAGRAM_REDIRECT_URI=https://your-frontend.example.com/auth/instagram/callback
# UploadThing (required for POST /api/media/upload)
UPLOADTHING_TOKEN=
# Optional overrides
# INSTAGRAM_OAUTH_TOKEN_URL=https://api.instagram.com/oauth/access_token
# INSTAGRAM_GRAPH_API_URL=https://graph.instagram.com

# Seed admin (optional - for prisma db seed)
SEED_ADMIN_EMAIL=admin@askmi.com
SEED_ADMIN_PASSWORD=Admin@123
SEED_ADMIN_FULLNAME=Admin User
```

## Database Setup

```bash
# Push schema to database
npx prisma db push

# Regenerate Prisma client
npx prisma generate
```

## Seed Data

See [Admin Seeder](README-ADMIN-SEEDER.md) for full documentation. Quick start:

```bash
npx prisma db seed
```

## Running the App

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

Server runs at `http://localhost:4000` (or your `PORT`).

## API Documentation

- **Swagger UI:** `http://localhost:4000/api-docs`

## API Overview

| Base Path | Description |
|-----------|-------------|
| `/api/auth` | Register, login |
| `/api/user` | Profile, preferences, admin user management |
| `/api/campaign` | Campaign CRUD |
| `/api/survey` | Survey CRUD |
| `/api/budget` | Budget config, price per unit vote, estimate |
| `/api/brand/statistics` | Brand dashboard stats |
| `/api/brand/analytics` | Full analytics (stats, chart data, campaigns table) |
| `/api/admin/brands` | Admin – list all brands |
| `/health` | Health check |

## Instagram Influencer Auth

`POST /api/auth/instagram` supports influencer sign in/sign up using the Instagram OAuth **authorization code** only. The backend exchanges the code for an access token using `INSTAGRAM_CLIENT_SECRET` (never send the secret from the frontend).

### Important

- Configure `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, and `INSTAGRAM_REDIRECT_URI` in `.env`.
- `INSTAGRAM_REDIRECT_URI` must be **identical** to the `redirect_uri` you used when sending the user to Instagram’s authorize URL (and must be allowed in the Meta app settings).

### Typical OAuth Flow

1. Frontend redirects the user to Instagram’s authorize URL (includes `client_id`, `redirect_uri`, `scope`, `response_type=code`, `state`).
2. Instagram redirects the user back to your `redirect_uri` with a `code` query parameter.
3. Frontend reads `code` and calls this API:

```http
POST /api/auth/instagram
Content-Type: application/json

{
  "code": "<authorization_code_from_redirect>",
  "fullName": "Optional Display Name"
}
```

### Response Behavior

- First valid login for that Instagram account creates an `influencer` user.
- Subsequent logins return the existing influencer user.
- Influencer accounts remain pending approval based on your approval flow.

## Media Upload (UploadThing)

`POST /api/media/upload` uploads images to UploadThing and returns `media.url`, `media.key`, and `media.name`.

### Required Setup

- Set `UPLOADTHING_TOKEN` in `.env`.
- This is validated at server startup; app will not boot without it.

## Roles

| Role | Access |
|------|--------|
| **admin** | Full access, user management, budget config |
| **brand** | Own campaigns, surveys, analytics, statistics |
| **influencer** | Own profile (requires admin approval) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:push` | Push schema to DB |
| `npm run prisma:seed` | Seed admin + preferences |
| `npm run prisma:studio` | Open Prisma Studio |

## Feature Documentation

- [Admin Seeder](README-ADMIN-SEEDER.md) - Seed admin user and preferences
- [Budget API](README-BUDGET.md) - Price per unit vote, budget estimate
- [Brand Statistics](README-BRAND-STATISTICS.md) - Dashboard stats
- [Analytics](README-ANALYTICS.md) - Full analytics endpoint

## Project Structure

```
src/
├── config/       # Swagger, etc.
├── controllers/
├── middleware/   # Auth, permissions
├── routes/
├── services/
├── types/
├── validators/
├── utils/
└── index.ts
prisma/
├── schema.prisma
└── seed.ts
```
