# Admin Dashboard Stats API

Admin-only endpoint for the app-wide dashboard summary.

## Endpoint

- `GET /api/admin/dashboard/stats`

## Auth and Access

- Requires `Authorization: Bearer <token>`
- Requires authenticated user role: `admin`

## Query Parameters

- `chartYear` (optional, integer): year for `voteCollectionOverTime` chart data
- Default `chartYear`: current year

## Response

```json
{
  "success": true,
  "message": "Admin dashboard statistics retrieved successfully",
  "stats": {
    "users": {
      "totalUsers": 1020,
      "brands": 15,
      "influencers": 5
    },
    "campaigns": {
      "activeCampaigns": 20,
      "pendingCampaigns": 15,
      "completedCampaigns": 5
    },
    "votes": {
      "totalVotes": 2318,
      "totalVoteTarget": 2520,
      "voteDelivery": 91.98
    },
    "ocr": {
      "reviewedCount": 1986,
      "approvedCount": 1937,
      "rejectedCount": 49,
      "ocrAccuracy": 97.53
    }
  },
  "voteCollectionOverTime": [
    {
      "month": "Jan",
      "monthIndex": 1,
      "year": 2026,
      "voteCount": 120
    }
  ],
  "ocrQueue": {
    "processedToday": 0,
    "autoVerified": 0,
    "pendingReview": 0,
    "flaggedFraud": 0
  },
  "ocrAccuracyTrend": [
    {
      "day": "Sun",
      "date": "2026-05-10",
      "reviewedCount": 12,
      "ocrAccuracy": 83.33
    }
  ],
  "topPerformers": [
    {
      "influencerId": "cmabc123",
      "fullName": "Sarah Johnson",
      "handle": "@sarah_lifestyle",
      "totalVotes": 540,
      "deviationPercent": 18.5
    }
  ],
  "underPerformingInfluencers": [
    {
      "influencerId": "cmdef456",
      "fullName": "John Doe",
      "handle": "@john_doe",
      "totalVotes": 76,
      "deviationPercent": -24.1
    }
  ]
}
```

## Field Definitions

- `stats.users.totalUsers`: all users in the platform
- `stats.users.brands`: users with role `brand`
- `stats.users.influencers`: users with role `influencer`

- `stats.campaigns.activeCampaigns`: campaigns where `isActive = true` and `isCompleted = false`
- `stats.campaigns.pendingCampaigns`: campaigns where `isActive = false` and `isCompleted = false`
- `stats.campaigns.completedCampaigns`: campaigns where `isCompleted = true`

- `stats.votes.totalVotes`: total records in `survey_responses`
- `stats.votes.totalVoteTarget`: sum of all campaign `totalVoteNeeded`
- `stats.votes.voteDelivery`: percentage `(totalVotes / totalVoteTarget) * 100`, rounded to 2 decimals

- `stats.ocr.reviewedCount`: total OCR result images reviewed (`approved + rejected`)
- `stats.ocr.approvedCount`: OCR result images with review status `approved`
- `stats.ocr.rejectedCount`: OCR result images with review status `rejected`
- `stats.ocr.ocrAccuracy`: percentage `(approvedCount / reviewedCount) * 100`, rounded to 2 decimals

- `voteCollectionOverTime`: 12-month series for the selected year
  - `month`: short month name (`Jan`..`Dec`)
  - `monthIndex`: month number (`1`..`12`)
  - `year`: selected chart year
  - `voteCount`: number of survey responses created in that month

- `ocrQueue.processedToday`: OCR images created today that are already reviewed (`approved + rejected`)
- `ocrQueue.autoVerified`: OCR images created today with status `approved`
- `ocrQueue.pendingReview`: OCR images currently in status `pending`
- `ocrQueue.flaggedFraud`: OCR images created today with status `rejected`

- `ocrAccuracyTrend`: trailing 7-day OCR review accuracy
  - `day`: weekday short name (`Sun`..`Sat`)
  - `date`: date in `YYYY-MM-DD`
  - `reviewedCount`: reviewed OCR records for that day
  - `ocrAccuracy`: percentage approved out of reviewed for that day

- `topPerformers`: top 5 influencers by total approved `reviewedVotes`
- `underPerformingInfluencers`: bottom 5 influencers by total approved `reviewedVotes`
  - `handle`: derived from email local-part (example: `john@example.com` -> `@john`)
  - `deviationPercent`: percentage difference vs platform average influencer votes

## Example Request

```http
GET /api/admin/dashboard/stats?chartYear=2026
Authorization: Bearer <token>
```
