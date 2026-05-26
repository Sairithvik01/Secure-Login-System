/* ================================================================
   env-config.example.js — TEMPLATE FILE (safe to commit)
   ----------------------------------------------------------------
   Copy this file to env-config.js and fill in your real values
   for local development.

   env-config.js is listed in .gitignore and will NEVER be committed.
   In CI/CD (GitHub Actions), this file is generated automatically
   from GitHub Secrets / Environment variables.
   ================================================================ */

window.__ENV__ = {
  FIREBASE_API_KEY:             "YOUR_API_KEY_HERE",
  FIREBASE_AUTH_DOMAIN:         "YOUR_PROJECT_ID.firebaseapp.com",
  FIREBASE_PROJECT_ID:          "YOUR_PROJECT_ID",
  FIREBASE_STORAGE_BUCKET:      "YOUR_PROJECT_ID.firebasestorage.app",
  FIREBASE_MESSAGING_SENDER_ID: "YOUR_MESSAGING_SENDER_ID",
  FIREBASE_APP_ID:              "YOUR_APP_ID"
};
