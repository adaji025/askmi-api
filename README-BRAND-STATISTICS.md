# Brand Statistics API

Single endpoint for the Brand Statistics dashboard. Returns all dashboard data in one call.

## Endpoint

**`GET /api/brand/statistics`**

Requires authentication and **brand** or **admin** role.

**Query Parameters**

| Parameter        | Type    | Default | Description                    |
|------------------|---------|---------|--------------------------------|
| `campaignsLimit` | integer | 10      | Max active campaigns (max 50)  |
| `activityLimit`  | integer | 10      | Max recent activity items (max 50) |

**Example**

```
GET /api/brand/statistics?activityLimit=20
```

**Response**

```json
{
  "success": true,
  "message": "Brand statistics retrieved successfully",
  "stats": {
    "activeCampaigns": 20,
    "totalResponses": 1800,
    "totalSurveys": 15,
    "completionRate": 20
  },
  "activeCampaigns": [
    {
      "id": "clx...",
      "campaignName": "Product Feedback Survey",
      "status": "active",
      "responseCount": 25,
      "totalVoteNeeded": 100,
      "progressPercent": 25
    }
  ],
  "recentActivity": [
    {
      "id": "clx...",
      "message": "Product Feedback Survey reached 1,800 responses",
      "campaignId": "clx...",
      "campaignName": "Product Feedback Survey",
      "responseCount": 1800,
      "createdAt": "2024-01-15T14:30:00.000Z",
      "timeAgo": "2 hours ago"
    }
  ]
}
```

## Response Fields

**stats**
- `activeCampaigns` – Count of campaigns with `isActive: true`
- `totalResponses` – Total survey responses across all campaigns
- `totalSurveys` – Total number of surveys
- `completionRate` – Percentage (0–100): total responses / total votes needed

**activeCampaigns**
- `status` – `"active"` or `"completed"`
- `responseCount` – Current responses
- `totalVoteNeeded` – Target responses
- `progressPercent` – Progress percentage (0–100)

**recentActivity**
- `message` – Human-readable activity text
- `timeAgo` – Relative time (e.g. "2 hours ago")
