# Admin Influencers API

Admin-only endpoints for listing influencers, viewing a single influencer, and reviewing influencer performance metrics.

## Base Route

- Primary: `/api/admin/influencers`
- Backward-compatible alias: `/api/user/admin/influencers`

Both routes use the same controller and return the same payload.

## Auth and Access

- Requires `Authorization: Bearer <token>`
- Requires authenticated user role: `admin`

## Endpoints

### Get all influencers

- `GET /api/admin/influencers`

Returns:

- `statistics` object (dashboard-level summary)
- `influencers` array (each influencer profile + computed performance fields)

#### Response shape

```json
{
  "success": true,
  "statistics": {
    "totalInfluencers": 42,
    "pendingApprovals": 8,
    "flaggedRisk": 3,
    "topPerformer": {
      "id": "cm123...",
      "fullName": "Jane Doe",
      "email": "jane@example.com",
      "totalSurveys": 12
    }
  },
  "influencers": [
    {
      "id": "cm456...",
      "email": "creator@example.com",
      "fullName": "Creator Name",
      "role": "influencer",
      "isApproved": true,
      "createdAt": "2026-04-15T10:00:00.000Z",
      "updatedAt": "2026-04-16T10:00:00.000Z",
      "totalCampaign": 4,
      "averageVote": 23.5,
      "performanceScore": 71.25,
      "deviationTrend": "up",
      "ocrAccuracy": 100
    }
  ]
}
```

### Get one influencer

- `GET /api/admin/influencers/:id`

Returns one influencer profile by user id.

## Statistics Definitions

- `totalInfluencers`: total number of users with role `influencer`
- `pendingApprovals`: influencers where `isApproved = false`
- `flaggedRisk`: influencers whose poll verification status is `rejected`
- `topPerformer`: influencer with highest `totalSurveys` count (nullable when no influencers exist)

## Influencer Metric Definitions

- `totalCampaign`: count of distinct non-null `campaignId` values across influencer surveys
- `averageVote`: `total survey responses / total surveys` (0 when no surveys)
- `performanceScore`: composite score (0-100, capped)
  - Current formula:
    - `(averageVote * 0.5) + (totalCampaign * 5) + (recentVotes * 1.5) + (ocrAccuracy * 0.2)`
- `deviationTrend`: compares recent vs previous 7-day vote windows
  - `up`: recent votes > previous votes
  - `down`: recent votes < previous votes
  - `stable`: equal
- `ocrAccuracy`:
  - `100` when poll verification status is `approved`
  - `50` when status is `submitted`
  - `0` otherwise

## Notes

- Field name is `performanceScore`.
- The list endpoint computes metrics server-side at request time.
