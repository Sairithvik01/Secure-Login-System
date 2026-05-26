# 🚀 Environment Secrets Setup Guide

This guide explains how to set up your Firebase credentials so the app works on GitHub Pages.

---

## 📋 Prerequisites

1. ✅ Firebase project created and configured
2. ✅ Firebase credentials obtained (from Firebase Console → Project Settings)
3. ✅ This repository pushed to GitHub

---

## 🔧 Step 1: Add GitHub Secrets

Your Firebase credentials need to be stored as GitHub Secrets so they're injected during deployment.

### How to Add Secrets:

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add each of the following:

| Secret Name | Value | Source |
|---|---|---|
| `FIREBASE_API_KEY` | Your Firebase API Key | Firebase Console → Project Settings |
| `FIREBASE_AUTH_DOMAIN` | e.g., `my-project.firebaseapp.com` | Firebase Console → Project Settings |
| `FIREBASE_PROJECT_ID` | Your Project ID | Firebase Console → Project Settings |
| `FIREBASE_STORAGE_BUCKET` | e.g., `my-project.appspot.com` | Firebase Console → Project Settings |
| `FIREBASE_MESSAGING_SENDER_ID` | Your Sender ID | Firebase Console → Project Settings |
| `FIREBASE_APP_ID` | Your App ID | Firebase Console → Project Settings |

### Where to Find These Values:

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the **gear icon** (⚙️) → **Project Settings**
4. Scroll to **"Your apps"** section
5. Find your Web app (should show `</>` icon)
6. Copy the `firebaseConfig` object:

```javascript
const firebaseConfig = {
  apiKey: "FIREBASE_API_KEY_HERE",
  authDomain: "FIREBASE_AUTH_DOMAIN_HERE",
  projectId: "FIREBASE_PROJECT_ID_HERE",
  storageBucket: "FIREBASE_STORAGE_BUCKET_HERE",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID_HERE",
  appId: "FIREBASE_APP_ID_HERE"
};
```

---

## 📝 Step 2: Verify Workflow

After adding all secrets:

1. Push a change to the `main` branch (or manually trigger the workflow)
2. Go to **Actions** tab in your GitHub repository
3. You should see **"Deploy to GitHub Pages"** workflow running
4. Once it completes ✅, your app is live!

---

## 🌐 Step 3: Access Your App

Your deployed app will be available at:

```
https://Sairithvik01.github.io/Secure-Login-System/
```

---

## ⚠️ How It Works (Security)

1. **GitHub Secrets** are encrypted and never exposed in logs
2. **GitHub Actions Workflow** (`deploy.yml`) reads secrets during build
3. `env-config.js` is **generated dynamically** at build time
4. `env-config.js` is **NOT committed** to the repository (protected by `.gitignore`)
5. Only the generated artifact is deployed to GitHub Pages

---

## 🛠️ Local Development

For testing locally without GitHub Actions:

1. Copy the template:
   ```bash
   cp js/env-config.example.js js/env-config.js
   ```

2. Edit `js/env-config.js` and fill in your real Firebase credentials:
   ```javascript
   window.__ENV__ = {
     FIREBASE_API_KEY:             "YOUR_ACTUAL_KEY_HERE",
     FIREBASE_AUTH_DOMAIN:         "your-project.firebaseapp.com",
     FIREBASE_PROJECT_ID:          "your-project-id",
     FIREBASE_STORAGE_BUCKET:      "your-project.appspot.com",
     FIREBASE_MESSAGING_SENDER_ID: "123456789",
     FIREBASE_APP_ID:              "1:123456789:web:abc..."
   };
   ```

3. Open `index.html` in your browser

**Note:** `js/env-config.js` is in `.gitignore` — it will never be committed.

---

## 🔐 Security Best Practices

✅ **DO:**
- Store credentials in GitHub Secrets
- Use environment variables in CI/CD
- Keep `env-config.js` in `.gitignore`
- Rotate credentials regularly

❌ **DON'T:**
- Commit credentials to the repository
- Share credentials via email or Slack
- Use the same credentials across projects
- Expose API keys in client-side code (Firebase keys are safe — they have security rules)

---

## 🆘 Troubleshooting

### "window.__ENV__ is not defined"
- **Cause:** `env-config.js` wasn't created
- **Fix:** Add GitHub Secrets and re-run the workflow

### Workflow fails with "undefined" values
- **Cause:** Secrets not set correctly in GitHub
- **Fix:** Double-check secret names and values in Settings → Secrets

### App still not working
1. Check GitHub Actions workflow logs: **Actions** tab
2. Verify all 6 Firebase secrets are present
3. Verify Firebase credentials are correct in your Firebase Console
4. Clear browser cache and do a hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

---

## 📚 Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Firebase Console](https://console.firebase.google.com/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)

---

**Questions?** Create an issue in the repository or check the main README.md
