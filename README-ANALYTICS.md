# Analytics API

Single endpoint for all brand analytics and dashboard data.

## Endpoint

**`GET /api/brand/analytics`**

Requires authentication and **brand** or **admin** role.

**Query Parameters**

| Parameter        | Type    | Default | Description                          |
|------------------|---------|---------|--------------------------------------|
| `campaignsLimit` | integer | 50      | Max campaigns in table and list      |
| `activityLimit`  | integer | 20      | Max recent activity items            |
| `chartYear`      | integer | current year | Year for vote collection chart |

**Example**

```
GET /api/brand/analytics?activityLimit=20&chartYear=2024
```

## Response Structure

```json
{
  "success": true,
  "message": "Analytics retrieved successfully",
  "stats": {
    "activeCampaigns": 4,
    "totalResponses": 20000,
    "totalSurveys": 15,
    "completionRate": 20,
    "totalVotes": 20000,
    "avgResponseRate": 78,
    "totalSpend": 63771
  },
  "voteCollectionOverTime": [
    { "month": "Jan", "year": 2024, "voteCount": 1200, "monthIndex": 1 },
    { "month": "Feb", "year": 2024, "voteCount": 1500, "monthIndex": 2 }
  ],
  "campaigns": [
    {
      "id": "clx...",
      "campaignName": "Product Feedback Survey",
      "status": "active",
      "responses": 1247,
      "completionRate": 82,
      "costPerResponse": 0.43,
      "influencers": 3,
      "confidence": "high"
    }
  ],
  "activeCampaigns": [...],
  "recentActivity": [...]
}
```

## Response Fields

**stats**
- `totalVotes` – Total survey responses
- `activeCampaigns` – Count of active campaigns
- `avgResponseRate` – Average completion rate across campaigns (%)
- `totalSpend` – totalVotes × pricePerUnitVote
- `totalSurveys` – Total surveys
- `completionRate` – Overall completion (total responses / total votes needed)

**voteCollectionOverTime**
- Chart data for "Vote Collection Over Time"
- One entry per month with `month`, `year`, `voteCount`, `monthIndex`

**campaigns**
- Table data for campaigns list
- `status` – `"active"` or `"completed"`
- `responses` – Response count
- `completionRate` – Percentage (0–100)
- `costPerResponse` – From pricePerUnitVote
- `influencers` – numberOfInfluencer
- `confidence` – `"high"` (≥80%), `"medium"` (≥50%), `"low"` (<50%)

**activeCampaigns** – Same as brand statistics (progress bars)

**recentActivity** – Same as brand statistics (activity feed)
