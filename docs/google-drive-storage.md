# Google Drive Storage Setup

Formula LMS can store course videos in Google Drive through a dedicated Drive service account.
This service account is separate from the Firebase Admin service account used for authentication.

## Install

```sh
npm install
npx prisma generate
npx prisma migrate deploy
```

## Google Cloud Setup

1. Create or select a Google Cloud project.
2. Enable the Google Drive API.
3. Create a service account.
4. Create a JSON key for the service account.
5. Create a Drive folder named `Formula LMS`, or let the backend create it.
6. If using a manually created folder, share it with the service account email as Editor.
7. Set `GOOGLE_DRIVE_FOLDER_ID` to that folder ID.

The backend creates this structure if it is missing:

```text
Formula LMS/
  Videos/
  CourseThumbnails/
  Documents/
```

## Environment Variables

Preferred local setup:

```text
backend/
  credentials/
    formula-41507-firebase-adminsdk-fbsvc-1cf96a82cc.json
    formulavideos-c2aa3728d05c.json
```

Use the Drive service account path:

```env
GOOGLE_SERVICE_ACCOUNT_JSON=./credentials/formulavideos-c2aa3728d05c.json
GOOGLE_DRIVE_FOLDER_ID=
```

Do not use the Firebase service account for Google Drive.

Alternative individual Drive fields:

```env
GOOGLE_PROJECT_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID=
```

Or inline the Drive service account JSON:

```env
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

## API

All endpoints require Firebase authentication. Upload, delete, and replace require admin access.

### Upload Video

```http
POST /api/storage/upload
Content-Type: multipart/form-data
Authorization: Bearer <Firebase ID token>
```

Fields:

- `courseId`
- `file`

Supported formats: `mp4`, `mov`, `mkv`, `webm`.

Maximum size: 5GB.

Response:

```json
{
  "success": true,
  "fileId": "google-drive-file-id",
  "filename": "lesson.mp4",
  "mimeType": "video/mp4",
  "size": 123456,
  "publicUrl": "/api/storage/video/google-drive-file-id"
}
```

### Stream Video

First fetch course video metadata:

```http
GET /api/storage/course/:courseId
Authorization: Bearer <Firebase ID token>
```

Response:

```json
{
  "video": {
    "id": "metadata-row-id",
    "courseId": "course-id",
    "googleDriveFileId": "google-drive-file-id",
    "filename": "lesson.mp4",
    "mimeType": "video/mp4",
    "size": 123456,
    "uploadedAt": "2026-07-20T00:00:00.000Z",
    "publicUrl": "/api/storage/video/google-drive-file-id"
  }
}
```

Then request a temporary stream URL:

```http
GET /api/storage/video-link/:fileId
Authorization: Bearer <Firebase ID token>
```

Response:

```json
{
  "url": "https://api.example.com/api/storage/video/file-id?expires=...&token=...",
  "expiresAt": "2026-07-20T00:15:00.000Z"
}
```

Then stream with the returned URL:

```http
GET /api/storage/video/:fileId?expires=...&token=...
Range: bytes=0-
```

The backend verifies the user has an active subscription before issuing the temporary URL. The stream endpoint forwards Range requests to Google Drive so seeking works without loading the full file into memory.

### Replace Course Video

```http
PUT /api/storage/:courseId
Content-Type: multipart/form-data
Authorization: Bearer <Firebase ID token>
```

Fields:

- `file`

Deletes the previous Google Drive file for that course, uploads the new file, and updates metadata.

### Delete Video

```http
DELETE /api/storage/:fileId
Authorization: Bearer <Firebase ID token>
```

Deletes the Drive file and metadata row.

## Production Notes

- Never expose service account credentials to the frontend.
- Keep the Drive folder private.
- Configure these variables in Render, then redeploy.
- Google Drive is not a video CDN. For many low-bandwidth users, HLS/adaptive streaming through a video CDN or Cloudflare Stream will perform better.
