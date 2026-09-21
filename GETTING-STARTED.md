# Getting started

Four steps. Roughly twenty minutes.

The GCP half you already do for a living, so it is written short. The Next.js half assumes
you have never touched React, so it is written long.

---

## What you are running

One Next.js app. It serves the pages **and** the API — there is no separate backend. It
talks to exactly one external thing: Google Drive.

Three conventions that make the file layout make sense:

- **A file in `src/app/` is a URL.** `src/app/(app)/album/page.tsx` is `/album`. The
  `(app)` in brackets is a route group; it does not appear in the URL. It exists so every
  page inside shares the sidebar and top bar from `layout.tsx`.
- **A file at `src/app/api/.../route.ts` is an HTTP endpoint.** `export async function GET`
  handles GET. That is the whole convention.
- **`"use client"` at the top** means the file runs in the browser and can hold state.
  `AlbumBrowser.tsx` has it; `page.tsx` does not.

---

## Step 1 — Node and dependencies

```bash
node -v          # -> v22.x
cd household
npm install      # -> a couple of minutes, creates node_modules/ and package-lock.json
```

The lockfile matters: the Dockerfile's `npm ci` needs it later.

---

## Step 2 — The OAuth client  (browser)

Console → **APIs & Services**.

1. **Library** → search **Google Drive API** → Enable.
2. **OAuth consent screen** → External → app name and your email → on **Test users**, add
   both addresses. Skip this and sign-in fails with `access_blocked`.
3. **Credentials → Create credentials → OAuth client ID → Web application.**

Authorised redirect URIs — add both now:

```
http://localhost:3000/api/auth/callback/google
http://localhost:5555/callback
```

Create, then copy the client ID and secret before closing the dialog. The ID ends in
`.apps.googleusercontent.com`; if yours does not, the copy was truncated.

---

## Step 3 — The Drive folder and its token

In the Drive of the account that will **own** the library, create a folder called
`Household`. Open it; the folder ID is the last part of the URL:

```
https://drive.google.com/drive/folders/1AbC...XyZ
                                       ^^^^^^^^^^
```

Then, once:

```bash
npm run drive:token
# paste the client ID and secret
# -> prints a URL. Open it, sign in AS THE OWNER, allow.
# -> prints DRIVE_REFRESH_TOKEN=1//0g...
```

If it says `(none returned)`: go to myaccount.google.com/permissions, remove the app, run
it again. Google only issues a refresh token on first consent.

---

## Step 4 — Env file, then run

```bash
cp .env.example .env.local
```

Six values:

```ini
AUTH_SECRET=            # openssl rand -base64 32
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
GOOGLE_CLIENT_ID=       # step 2
GOOGLE_CLIENT_SECRET=   # step 2
ALLOWED_EMAILS=you@gmail.com,her@gmail.com
DRIVE_REFRESH_TOKEN=    # step 3
DRIVE_ROOT_FOLDER_ID=   # step 3
```

No quotes, no trailing spaces. Then:

```bash
npm run dev      # -> Local: http://localhost:3000
```

Sign in, click **Album → New folder → "Test"**, open it, drag in a photo. Watch:

1. Progress bar to 100%
2. Tile appears with a shimmer
3. Photo fades in within a few seconds (Drive is rendering the thumbnail)
4. **Check Drive** — `Household/Test/yourphoto.jpg` is there

All four means everything works. Now try the reverse: add a photo to that folder from the
Drive app, reload the website, and it appears. That is the point of this architecture.

---

## Deploy to Cloud Run

Standard for you, so only the app-specific bits:

```bash
PROJECT=your-project; REGION=asia-south1
gcloud services enable run.googleapis.com drive.googleapis.com

for s in AUTH_SECRET GOOGLE_CLIENT_SECRET DRIVE_REFRESH_TOKEN; do
  echo -n "${!s}" | gcloud secrets create $s --data-file=- 2>/dev/null || \
  echo -n "${!s}" | gcloud secrets versions add $s --data-file=-
done

gcloud run deploy household --source . --region=$REGION \
  --allow-unauthenticated --min-instances=0 --cpu=1 --memory=512Mi \
  --set-env-vars="AUTH_TRUST_HOST=true,GOOGLE_CLIENT_ID=...,ALLOWED_EMAILS=...,DRIVE_ROOT_FOLDER_ID=..." \
  --set-secrets="AUTH_SECRET=AUTH_SECRET:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest,DRIVE_REFRESH_TOKEN=DRIVE_REFRESH_TOKEN:latest"

URL=$(gcloud run services describe household --region=$REGION --format='value(status.url)')
gcloud run services update household --region=$REGION --update-env-vars="AUTH_URL=$URL"
```

`--allow-unauthenticated` is correct: the site is meant to be reachable, the allowlist is
the door.

Then add `$URL/api/auth/callback/google` as a redirect URI on the OAuth client.

**`--min-instances=1` is worth the few rupees a month here.** The folder cache lives in
memory, so a cold start means every listing refetches from Drive.

No IAM roles, no bucket, no database. That is the whole deployment.

---

## When it breaks

| What you see | What it is |
|---|---|
| `Error 401: invalid_client` | The OAuth client does not exist yet (step 2), or `GOOGLE_CLIENT_ID` is empty, truncated or has a stray space |
| `access_blocked` | Your email is not a test user on the consent screen |
| Signed in, bounced back to /signin | Your email is not in `ALLOWED_EMAILS`, or it is not lowercase |
| `Missing required env var: X` | Exactly that. Restart `npm run dev` after editing `.env.local` — env is read at boot |
| `That folder is not inside the library` | The folder ID does not descend from `DRIVE_ROOT_FOLDER_ID`. Usually a wrong root ID |
| `Could not mint a Drive access token` | `DRIVE_REFRESH_TOKEN` is wrong or revoked. Redo step 3 |
| Tile shimmers, then "Drive is still processing" | Normal for large videos. Reload in a minute |
| Grid feels slow on the first load after idle | Cold start plus an empty cache. `--min-instances=1` fixes it |

---

## Changing things

**Colours** — CSS variables at the top of `src/app/globals.css`.

**Tiles and sidebar** — one array in `src/lib/sections.ts`. Flip `ready: true` to light a
section up.

**A new section** is three files: a page, a route, and that flag.
