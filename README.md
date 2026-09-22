# Household

A private website for two people. Public URL, allowlisted door.

---

## What it is

One Next.js app on Cloud Run. It serves the pages and the API — no separate backend.
Album and Documents live entirely in Google Drive (no database for either). The other
nine sections are small structured records — a budget entry, a bill, a bag of list
items — that don't map to files, so they live in Firestore instead: one collection per
section, read and written only from server-side API routes with the same service
account's credentials that talk to Drive. There's still no client SDK, no security
rules, no queue — the allowlist check in every route is the only door, same as Drive.

All sections are live: **Album** · Money · Net worth · Documents · Lists · Bills ·
Dates · Trips · Wishlist · Vehicles · Emergency. Currency throughout is INR
(`src/lib/money.ts`).

---

## Conventions

Three things that make the file layout make sense:

- **A file in `src/app/` is a URL.** `src/app/(app)/album/page.tsx` is `/album`. The
  `(app)` in brackets is a route group; it does not appear in the URL. It exists so every
  page inside shares the sidebar and top bar from that group's `layout.tsx`.
- **A file at `src/app/api/.../route.ts` is an HTTP endpoint.** `export async function GET`
  handles GET. That is the whole convention.
- **`"use client"` at the top** means the file runs in the browser and can hold state.
  `AlbumBrowser.tsx` has it; `page.tsx` files generally don't.

---

## Architecture

```
Browser
  │
  ├─ Upload
  │    └─ POST /api/uploads/session  → app opens a Drive resumable session
  │         browser PUTs bytes straight to Google — nothing large touches Cloud Run
  │
  ├─ Browse
  │    └─ GET /api/browse?folder=X   → one Drive files.list call → folders + media
  │         TTL cache: 60 s per folder listing, 30 min per folder node
  │
  ├─ Thumbnails
  │    └─ GET /api/thumb/[id]?w=520  → proxies Drive's own thumbnail renderer
  │         thumbnailLink cached 50 min in-process (skips the metadata call)
  │         browser caches the image forever (immutable header)
  │
  ├─ Video
  │    └─ GET /api/stream/[id]       → proxies Drive with Range support so seek works
  │
  ├─ Delete / rename
  │    └─ DELETE or PATCH /api/media/[id]?folder=X
  │         delete trashes in Drive (recoverable there, not a hard delete);
  │         rename works on files and folders identically
  │
  ├─ Bulk delete
  │    └─ POST /api/media/bulk-delete  {ids, folder} → one round trip for N deletes
  │
  └─ Search
       └─ GET /api/search?q=X        → whole-library name search, not just the current folder
            Drive's `in parents` only checks the direct parent, so this queries
            broadly then keeps only results descending from the root (reusing
            breadcrumbs()'s ancestry walk), capped at 25 matches
```

**Album extras:** sorted by actual photo-taken date (EXIF `imageMediaMetadata.time`
when Drive has it, not upload time — `orderBy` can't sort by EXIF server-side, so this
is a client-side sort in `listFolder()`), a camera-capture upload button on top of the
regular gallery-picker upload, multi-select for bulk delete, and a photo/video count
next to the folder subtitle (computed from data already fetched, no extra call).

**Stack:** Next.js 15 · React 19 · TypeScript · Auth.js v5 · SWR · Tailwind v4

---

## Is this the best architecture for fast image loading?

**Honest answer: it depends on what "fast" means to you.**

| Scenario | This arch | With a CDN thumbnail cache (GCS) |
|---|---|---|
| Second load, same browser | Instant (browser cache, immutable) | Instant |
| Second load, different device | 200–400 ms per image | ~30 ms per image |
| First load of 200 photos | Slow (200 proxied requests) | Fast (direct CDN URLs) |
| Cost | ~₹0/month | ~₹2–5/month for thumbnails in GCS |

The current architecture is fine for a family of two who mostly use the same devices.
If you want every first load to be gallery-fast across devices, the upgrade path is:

1. Add a GCS bucket — store 520 px WebP thumbnails there
2. Add a background job (Cloud Tasks) that downloads and resizes on upload
3. Serve signed GCS URLs directly in `<img>` — no Cloud Run proxy

The code is structured to make this addition clean. `src/lib/drive.ts` handles Drive;
a new `src/lib/gcs.ts` would handle thumbnails. Nothing else changes.

---

## Env vars

| Var | Where it is used | What it is |
|---|---|---|
| `AUTH_SECRET` | `src/lib/auth.ts` | Signs JWT sessions — `openssl rand -base64 32` |
| `AUTH_URL` | Auth.js internals | Full origin — `http://localhost:3000` locally, Cloud Run URL in prod |
| `AUTH_TRUST_HOST` | Auth.js internals | Must be `true` on Cloud Run (trusts `X-Forwarded-Host`) |
| `GOOGLE_CLIENT_ID` | `src/lib/auth.ts`, `src/lib/drive.ts` | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | `src/lib/auth.ts`, `src/lib/drive.ts` | OAuth 2.0 client secret |
| `ALLOWED_EMAILS` | `src/lib/env.ts` → `src/lib/auth.ts` | Comma-separated, lowercase — the only addresses that can sign in |
| `DRIVE_REFRESH_TOKEN` | `src/lib/drive.ts` | Long-lived token for the Drive owner account |
| `DRIVE_ROOT_FOLDER_ID` | `src/lib/drive.ts` | Drive folder ID that is the root of the Album library |
| `DRIVE_DOCS_ROOT_FOLDER_ID` | `src/lib/drive.ts` | A separate Drive folder that is the root of the Documents library |
| `GOOGLE_CLOUD_PROJECT` | `src/lib/gcs.ts`, `src/lib/firestore.ts` | GCP project ID — also selects the Firestore database |
| `GCS_BUCKET` | `src/lib/gcs.ts` | The bucket that caches generated WebP thumbnails |

---

## Local setup

### 1 — Node and deps

```bash
node -v      # v22.x required
npm install
```

### 2 — OAuth client (GCP Console — browser clicks)

1. APIs & Services → Library → enable **Google Drive API**
2. OAuth consent screen → External → add both emails as **Test users**
   (skip this → sign-in fails with `access_blocked`)
3. Credentials → Create → OAuth client ID → **Web application**
   Add both redirect URIs now:
   ```
   http://localhost:3000/api/auth/callback/google
   http://localhost:5555/callback
   ```
   Copy the client ID and secret.

### 3 — Drive folder (browser)

In the account that will own the library, create a folder named `Household` in Drive.
The folder ID is the last segment of the URL:
```
https://drive.google.com/drive/folders/1AbC...XyZ
                                       ^^^^^^^^^^^ copy this
```

### 4 — Drive refresh token

```bash
npm run drive:token
# → prints a URL, open it, sign in as the Drive owner account, allow
# → prints DRIVE_REFRESH_TOKEN=1//0g...
```

**Token lifetime:** never expires under normal use. Expires after 7 days idle if the
OAuth consent screen is still in Testing mode — publish the app to remove that limit.

### 5 — Env file

```bash
cp .env.example .env.local
# fill in all 8 values — no quotes, no inline comments
```

### 6 — Run

```bash
npm run dev      # → http://localhost:3000
```

Sign in, click Album, create a folder, drag in a photo. It should appear within a few seconds.

---

## Deploy to Cloud Run

**Current deployment:** project `household-509314`, region `asia-southeast1` (Singapore
— chosen specifically because it's one of the few regions where Cloud Run supports
custom domain mapping; `asia-south1` does not, which is why this moved), service
`household`, running as the dedicated `household-app` service account (Secret Manager
access to the three secrets below, object-admin on nothing else — Drive access comes
from `DRIVE_REFRESH_TOKEN`, not the GCP service identity). Once your env is set up
(steps 1–5 above, pointed at that project), shipping a change is:

```bash
npm run deploy
```

That's `gcloud run deploy household --source . --project=household-509314 --region=asia-southeast1`
under the hood — env vars, secrets, and the service account all carry over from the
previous revision automatically; you only need to touch the flags below if you're
bootstrapping a **new** project from scratch or rotating a secret.

**Bootstrapping a new project:**

```bash
PROJECT=your-project-id
REGION=asia-southeast1   # must be a domain-mapping-capable region if you plan to use a custom domain — see https://docs.cloud.google.com/run/docs/mapping-custom-domains

gcloud services enable run.googleapis.com drive.googleapis.com secretmanager.googleapis.com

# Secrets in Secret Manager
for s in AUTH_SECRET GOOGLE_CLIENT_SECRET DRIVE_REFRESH_TOKEN; do
  echo -n "${!s}" | gcloud secrets create $s --data-file=- 2>/dev/null || \
  echo -n "${!s}" | gcloud secrets versions add $s --data-file=-
done

gcloud run deploy household --source . --region=$REGION \
  --allow-unauthenticated \
  --min-instances=1 --cpu=1 --memory=512Mi \
  --set-env-vars="AUTH_TRUST_HOST=true,GOOGLE_CLIENT_ID=...,ALLOWED_EMAILS=...,DRIVE_ROOT_FOLDER_ID=..." \
  --set-secrets="AUTH_SECRET=AUTH_SECRET:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,DRIVE_REFRESH_TOKEN=DRIVE_REFRESH_TOKEN:latest"

URL=$(gcloud run services describe household --region=$REGION --format='value(status.url)')
gcloud run services update household --region=$REGION \
  --update-env-vars="AUTH_URL=$URL"
```

Add `$URL/api/auth/callback/google` as a redirect URI on the OAuth client.

**Rollback** — every deploy leaves the old revision running underneath; nothing is deleted:

```bash
gcloud run services update-traffic household --region=$REGION --to-revisions=<old-revision>=100
```

**`--min-instances=1`** — the in-process folder cache lives in memory. A cold start
means the first listing re-fetches from Drive. One warm instance costs a few rupees a month.

**IAM** — the service account needs `roles/secretmanager.secretAccessor` (the three
secrets), `roles/storage.objectAdmin` scoped to just the thumbnail bucket, and
`roles/datastore.user` for Firestore. Drive access itself comes from
`DRIVE_REFRESH_TOKEN`, not from the GCP service identity — nothing Drive-related needs
an IAM role.

**`--allow-unauthenticated`** is intentional — the allowlist is the door, not GCP IAM.

**Ops already wired up:** a budget alert and a Cloud Monitoring uptime check (pings
`/signin` every 5 min, emails on failure) are configured directly in the GCP project —
not in this repo, since there's no IaC here by design. Check the Cloud Console if you
need to change thresholds or the alert email.

---

## Changing things

**Colours** — CSS variables at the top of `src/app/globals.css`.

**Tiles and sidebar** — one array in `src/lib/sections.ts`. Flip `ready: true` to light
a section up.

**Adding a section** is three files:

1. `src/app/(app)/<name>/page.tsx` — the page
2. `src/app/api/<name>/route.ts` — GET / POST handlers
3. Flip `ready: true` in `src/lib/sections.ts`

The album is the reference. Documents is the same code pointed at a different Drive folder.
Sections that need their own records (Money, Lists, Bills) will add Firestore then — one
collection per section, nothing shared with the album.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Error 401: invalid_client` | `GOOGLE_CLIENT_ID` wrong, has quotes, or client was deleted |
| `access_blocked` | Email not added as Test user on the consent screen |
| Signed in, bounced to /signin | Email not in `ALLOWED_EMAILS` or not lowercase |
| `File not found: <id>` | Refresh token belongs to a different account than the folder owner |
| `Could not mint a Drive access token` | `DRIVE_REFRESH_TOKEN` was revoked — rerun `npm run drive:token` |
| `That folder is not inside the library` | The folder ID doesn't descend from `DRIVE_ROOT_FOLDER_ID` — usually a wrong root ID |
| Tile shimmers then says "still processing" | Drive hasn't generated the thumbnail yet — wait ~30 s and reload |
| Grid feels slow on first load after idle | Cold start plus an empty cache — `--min-instances=1` fixes it |
| Video plays but can't seek | `Range` header not forwarded — check `src/app/api/stream/[id]/route.ts` |
