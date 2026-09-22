/**
 * Run once, on your laptop, as the account that will OWN the photo library.
 *
 *   node scripts/drive-token.mjs
 *
 * Add http://localhost:5555/callback as an authorised redirect URI on your OAuth
 * client first. Prints a refresh token — put it in DRIVE_REFRESH_TOKEN.
 */
import http from "node:http";
import { createInterface } from "node:readline/promises";

const PORT = 5555;
const REDIRECT = `http://localhost:${PORT}/callback`;
// Not drive.file: that scope only grants access to files this app itself
// created, so a photo added directly in Drive (not through the app) would
// be invisible to every files.list call here, no matter the cache TTL.
// Full `drive` is what actually makes "add a photo in Drive, it appears in
// the app" work, per this repo's own README.
const SCOPE = "https://www.googleapis.com/auth/drive";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const clientId = process.env.GOOGLE_CLIENT_ID ?? (await rl.question("GOOGLE_CLIENT_ID: "));
const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? (await rl.question("GOOGLE_CLIENT_SECRET: "));
rl.close();

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  });

console.log("\nOpen this in the browser, signed in as the library owner:\n");
console.log(authUrl + "\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") return res.end();

  const code = url.searchParams.get("code");
  if (!code) {
    res.end("No code came back.");
    return;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const token = await tokenRes.json();

  res.end("Done. Go back to the terminal.");
  console.log("\nDRIVE_REFRESH_TOKEN=" + (token.refresh_token ?? "(none returned — revoke access and retry)"));
  server.close();
  process.exit(0);
});

server.listen(PORT, () => console.log(`Waiting on ${REDIRECT} ...`));
