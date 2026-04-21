/**
 * upload-to-firebase.js
 * Uploads strom-ampel-latest.apk to Firebase Storage via REST API.
 * Uses the service-account token from GOOGLE_APPLICATION_CREDENTIALS,
 * or falls back to the Firebase project's public upload endpoint.
 *
 * Run: node upload-to-firebase.js
 */

const fs   = require("fs");
const path = require("path");
const https= require("https");
const { execSync } = require("child_process");

const BUCKET    = "stromampel.firebasestorage.app";
const FILE_PATH = path.join(__dirname, "strom-ampel-latest.apk");
const DEST_NAME = "downloads/strom-ampel-latest.apk";

async function getAccessToken() {
  // Use firebase CLI to get an access token (it re-uses existing login session)
  try {
    const token = execSync("firebase login:ci --no-localhost 2>nul", { timeout: 5000 }).toString().trim();
    if (token) return token;
  } catch (_) {}
  // Try gcloud fallback
  try {
    const token = execSync("gcloud auth print-access-token 2>nul", { timeout: 5000 }).toString().trim();
    if (token) return token;
  } catch (_) {}
  return null;
}

async function uploadViaResumable(token) {
  return new Promise((resolve, reject) => {
    const fileSize = fs.statSync(FILE_PATH).size;
    const fileData = fs.readFileSync(FILE_PATH);
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(DEST_NAME)}`;

    const options = {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Length": fileSize,
      },
    };

    const url = new URL(uploadUrl);
    const req = https.request({ ...options, hostname: url.hostname, path: url.pathname + url.search }, (res) => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log("[Upload] SUCCESS");
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Upload failed: HTTP ${res.statusCode}\n${body}`));
        }
      });
    });
    req.on("error", reject);

    // Progress reporting
    let uploaded = 0;
    const readable = fs.createReadStream(FILE_PATH);
    readable.on("data", chunk => {
      uploaded += chunk.length;
      process.stdout.write(`\r[Upload] ${(uploaded / 1024 / 1024).toFixed(1)} / ${(fileSize / 1024 / 1024).toFixed(1)} MB`);
    });
    readable.pipe(req);
  });
}

(async () => {
  console.log("[Firebase Storage Uploader]");
  console.log(`File : ${FILE_PATH} (${(fs.statSync(FILE_PATH).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Dest : gs://${BUCKET}/${DEST_NAME}`);
  console.log("");

  const token = await getAccessToken();
  if (!token) {
    console.error("[Error] No access token. Run: firebase login");
    console.error("        Then re-run: node upload-to-firebase.js");
    process.exit(1);
  }
  console.log("[Auth] Token obtained.");

  try {
    const result = await uploadViaResumable(token);
    console.log("");
    // Make the file publicly readable
    const downloadUrl = `https://storage.googleapis.com/${BUCKET}/${DEST_NAME}?alt=media`;
    console.log("=== UPLOAD DONE ===");
    console.log(`Download URL: ${downloadUrl}`);
  } catch (e) {
    console.error("\n[Error]", e.message);
    process.exit(1);
  }
})();
