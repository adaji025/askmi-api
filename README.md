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
| `/health` | Health check |

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
