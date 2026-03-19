# Budget API

Budget configuration and estimation endpoints for the AskMI Backend.

## Base URL

```
/api/budget
```

All endpoints require authentication via `Authorization: Bearer <token>`.

---

## Endpoints

### 1. Get Budget Estimate

**`GET /api/budget/estimate`**

Calculates a budget estimate using the core formula with a ±20% deviation range. Available to all authenticated users.

**Query Parameters**

| Parameter        | Type    | Required | Description                    |
|-----------------|---------|----------|--------------------------------|
| `totalQuestions` | integer | Yes      | Total number of survey questions |
| `desiredVote`   | integer | Yes      | Total desired votes            |

**Formula**

```
Budget = Total Questions × Total Desired Votes
minBudget = baseBudget × 0.8
maxBudget = baseBudget × 1.2
```

**Example Request**

```
GET /api/budget/estimate?totalQuestions=10&desiredVote=1000
```

**Example Response**

```json
{
  "success": true,
  "message": "Budget estimate calculated successfully",
  "estimate": {
    "baseBudget": 10000,
    "minBudget": 8000,
    "maxBudget": 12000,
    "totalQuestions": 10,
    "desiredVote": 1000,
    "deviationPercent": 20
  }
}
```

---

### 2. Get Price Per Unit Vote

**`GET /api/budget`**

Returns the current price per unit vote configuration. **Admin only.**

**Example Response (config set)**

```json
{
  "success": true,
  "message": "Budget config retrieved successfully",
  "budget": {
    "id": "clx...",
    "pricePerUnitVote": 0.5,
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

**Example Response (using default)**

When the admin has not set a value yet, the default `0.5` is returned:

```json
{
  "success": true,
  "message": "Using default price per unit vote until admin sets a value",
  "budget": {
    "id": null,
    "pricePerUnitVote": 0.5,
    "createdAt": null,
    "updatedAt": null,
    "isDefault": true
  }
}
```

---

### 3. Set Price Per Unit Vote

**`POST /api/budget`**

Creates or sets the price per unit vote. **Admin only.**

**Request Body**

```json
{
  "pricePerUnitVote": 0.5
}
```

| Field             | Type   | Required | Description                          |
|-------------------|--------|----------|--------------------------------------|
| `pricePerUnitVote`| number | Yes      | Positive number (e.g. 0.5, 1.25)     |

**Example Response**

```json
{
  "success": true,
  "message": "Price per unit vote set successfully",
  "budget": {
    "id": "clx...",
    "pricePerUnitVote": 0.5,
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

---

### 4. Update Price Per Unit Vote

**`PUT /api/budget`**

Updates the price per unit vote. Creates the config if it does not exist. **Admin only.**

**Request Body**

```json
{
  "pricePerUnitVote": 0.75
}
```

**Example Response**

```json
{
  "success": true,
  "message": "Price per unit vote updated successfully",
  "budget": {
    "id": "clx...",
    "pricePerUnitVote": 0.75,
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-01-15T14:30:00.000Z"
  }
}
```

---

## Access Control

| Endpoint                    | Roles          |
|----------------------------|----------------|
| `GET /api/budget/estimate` | All authenticated |
| `GET /api/budget`          | Admin only     |
| `POST /api/budget`         | Admin only     |
| `PUT /api/budget`          | Admin only     |

---

## Default Values

- **Price per unit vote:** `0.5` (used until admin sets a value)
- **Deviation:** ±20% on budget estimates

The default price can be changed in `src/services/budgetService.ts` via `DEFAULT_PRICE_PER_UNIT_VOTE`.

---

## Database

The budget config is stored in the `budget_configs` table. Run migrations before using:

```bash
npx prisma db push
```
