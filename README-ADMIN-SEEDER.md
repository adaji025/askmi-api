# Admin Seeder

Seeds an admin user and sets default preferences for all users.

## Command

```bash
npx prisma db seed
```

## Default Admin Credentials

- **Email:** `admin@askmi.com`
- **Password:** `Admin@123`

## Customization

Set these in `.env` to customize the seeded admin:

| Variable | Default | Description |
|----------|---------|-------------|
| `SEED_ADMIN_EMAIL` | `admin@askmi.com` | Admin email |
| `SEED_ADMIN_PASSWORD` | `Admin@123` | Admin password |
| `SEED_ADMIN_FULLNAME` | `Admin User` | Display name |

The seed uses `upsert` by email, so it's safe to run multiple times. It will update the existing admin or create a new one with the configured values.
