# Campaign result images (influencer proofs)

Approved influencers can attach multiple **result images** per campaign (screenshots or other proof of delivery). Files are stored on **UploadThing**; the API stores metadata in PostgreSQL (`CampaignResultImage` / table `campaign_result_images`).

## Prerequisites

- **`UPLOADTHING_TOKEN`** set (see **Media Upload (UploadThing)** in the main [README](README.md)). The app validates this at startup.
- Influencer must have an **`approved`** row in `campaign_applications` for that campaign.

## Limits

- **20** images per influencer per campaign (hard cap in `campaignService`).

## Base paths (equivalent)

Use either prefix; behavior is the same.

| Action | Campaign router | Shorter alias (under `/api/influencer`) |
|--------|-----------------|----------------------------------------|
| List | `GET /api/campaign/influencer/<campaignId>/result-images` | `GET /api/influencer/<campaignId>/result-images` |
| Add | `POST /api/campaign/influencer/<campaignId>/result-images` | `POST /api/influencer/<campaignId>/result-images` |
| Delete | `DELETE /api/campaign/influencer/<campaignId>/result-images/<imageId>` | `DELETE /api/influencer/<campaignId>/result-images/<imageId>` |

## Typical flow (influencer)

### Option A — One request (multipart file)

`POST` to either path in the table with **`Content-Type: multipart/form-data`** and **one image file** (any field name). The server uploads to UploadThing and saves the campaign result row. Optional **caption** is only supported with Option B (JSON body).

### Option B — Two steps (generic media upload, then JSON)

1. **Upload the file** (multipart, field name `screenshot`):

   ```http
   POST /api/media/upload
   Authorization: Bearer <token>
   Content-Type: multipart/form-data
   ```

   Response includes `media.url` and optionally `media.key` (UploadThing file key—store it if you want delete to remove the file from storage).

2. **Register the image on the campaign** (`Content-Type: application/json`):

   ```http
   POST /api/influencer/<campaignId>/result-images
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "imageUrl": "<media.url from step 1>",
     "fileKey": "<media.key optional>",
     "caption": "Optional short note",
     "surveyQuestionId": "Optional question identifier"
   }
   ```

### List and delete

```http
GET /api/influencer/<campaignId>/result-images
Authorization: Bearer <token>
```

```http
DELETE /api/influencer/<campaignId>/result-images/<imageId>
Authorization: Bearer <token>
```

Delete removes the DB row; if `fileKey` was stored, UploadThing delete is attempted.

## Campaign detail responses (read)

### `GET /api/campaign/:campaignId`

- **Admin** or **brand who owns the campaign**: extra field **`resultImages`** — all influencers’ images, each with `id`, `influencerId`, `influencerName`, `imageUrl`, `caption`, `createdAt`, plus **`reviewStatus`**, **`reviewedVotes`**, **`reviewNotes`**, **`reviewedAt`**, **`reviewedByAdminId`**, **`reviewerName`** (admin display name when set).
- **Approved influencer** on that campaign: **`myResultImages`** — same review fields for their own uploads (no `influencerName` on each row).

Other roles do not receive these arrays.

### `GET /api/campaign/influencer/:campaignId`

Same visibility rules as above for the authenticated influencer (and admin/owner when calling with those roles).

## Admin campaigns API

`GET /api/admin/campaigns` and `GET /api/admin/campaigns/:campaignId` include:

- **`reviewedDeliveredVote`** — sum of **`reviewedVotes`** on images with **`reviewStatus: approved`** for that campaign (admin-recorded votes from proofs).
- On each **`influencers`** entry:
  - **`influencerId`**, **`reviewedVotesTotal`** — same sum but only that influencer’s approved images
  - **`resultImages`** — each item includes `id`, `imageUrl`, `caption`, `createdAt`, `reviewStatus`, `reviewedVotes`, `reviewNotes`, `reviewedAt`, `reviewedByAdminId`

## Admin review (record votes from proof)

1. **List images** (optional query filters; max 500 rows):

   ```http
   GET /api/admin/campaign-result-images?campaignId=<id>&influencerId=<id>&reviewStatus=pending
   Authorization: Bearer <admin token>
   ```

2. **Submit review** for one image (`imageId` from list or from `resultImages[].id`):

   ```http
   PATCH /api/admin/campaign-result-images/<imageId>/review
   Authorization: Bearer <admin token>
   Content-Type: application/json

   {
     "reviewStatus": "approved",
     "reviewedResponseObject": {
       "questionType": "multi_choice",
       "options": [
         { "optionText": "Option 1", "votes": 20 },
         { "optionText": "Option 2", "votes": 12 },
         { "optionText": "Option 3", "votes": 10 }
       ]
     },
     "reviewNotes": "Optional note"
   }
   ```

   - **`approved`**: **`reviewedResponseObject`** is required (for `multi_choice`, `yes_no`, or `rating_scale`) and `reviewedVotes` is auto-derived by summing votes in the object.
   - **`rejected`** or **`pending`**: recorded vote data is cleared; you may still send **`reviewNotes`**.

## Data model (Prisma)

- Model: **`CampaignResultImage`**
- Core fields: `campaignId`, `influencerId`, optional `surveyQuestionId`, `imageUrl`, optional `fileKey`, optional `caption`, timestamps
- Review: **`reviewStatus`** (`pending` | `approved` | `rejected`), optional **`reviewedVotes`**, optional **`reviewNotes`**, optional **`reviewedByAdminId`** / **`reviewedAt`**
- Relations: **`Campaign`**, **`User`** (uploader, `CampaignResultImageUploader`), optional **`User`** (reviewer admin, `CampaignResultImageReviewer`); cascade on campaign/uploader delete, `SetNull` on reviewer delete

After schema changes:

```bash
npx prisma generate
npx prisma db push
```

Use your team’s preferred migration workflow if you do not use `db push` in production.

## Swagger

Open **`/api-docs`**. Result-image routes appear under **Campaign** (canonical paths), **Influencer Verification** (shorter `/api/influencer/{campaignId}/result-images` aliases), and **Admin** (`/api/admin/campaign-result-images` list + review).
