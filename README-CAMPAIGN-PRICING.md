# Campaign Pricing in GET Campaign Responses

This document explains the pricing fields now returned on all campaign retrieval endpoints.

## Fields Added

Each campaign object now includes:

- `estimatedPrice`
- `influencerEstimatedPrice`

## Formula

### 1) Estimated Price

```
estimatedPrice = totalVoteNeeded * numberOfQuestions * pricePerUnitVote
```

### 2) Influencer Estimated Price

```
influencerEstimatedPrice = estimatedPrice * 0.5
```

Both values are rounded to 2 decimal places.

## Price Source

- `pricePerUnitVote` is read from budget config (`/api/budget`, key: `default`)
- If no admin value is set, the system uses:
  - `DEFAULT_PRICE_PER_UNIT_VOTE = 0.5`

## Endpoints Covered

The fields are included in campaign objects returned by:

- `GET /api/campaign`
- `GET /api/campaign/mine`
- `GET /api/campaign/user/:userId`
- `GET /api/campaign/:id`
- `GET /api/admin/campaigns`
- `GET /api/admin/campaigns/:id`

## Example Campaign Object (Common Endpoints)

```json
{
  "id": "cm123...",
  "campaignName": "Summer Promo",
  "totalVoteNeeded": 500,
  "numberOfQuestions": 10,
  "response": 320,
  "estimatedPrice": 2500,
  "influencerEstimatedPrice": 1250
}
```

## Example Admin Single Campaign Response

```json
{
  "success": true,
  "campaign": {
    "id": "cm123...",
    "campaignName": "Summer Promo",
    "totalVoteNeeded": 500,
    "numberOfQuestions": 10,
    "status": "active",
    "estimatedPrice": 2500,
    "influencerEstimatedPrice": 1250
  }
}
```

## Notes

- `estimatedPrice` and `influencerEstimatedPrice` are computed at response time.
- No database migration is required for these fields.

## Admin: Extend Campaign End Date

Admin can extend a campaign's end date using:

- `PATCH /api/admin/campaigns/:id/extend-end-date`

### Request Body

```json
{
  "endDate": "2026-06-15T23:59:59.000Z"
}
```

### Rules

- `endDate` is required
- `endDate` must be a valid date string
- if campaign already has an `endDate`, the new `endDate` must be later than the current one

### Example Success Response

```json
{
  "success": true,
  "message": "Campaign end date extended successfully",
  "campaign": {
    "id": "cm123...",
    "campaignName": "Summer Promo",
    "startDate": "2026-05-01T00:00:00.000Z",
    "endDate": "2026-06-15T23:59:59.000Z",
    "updatedAt": "2026-05-01T08:30:00.000Z"
  }
}
```
