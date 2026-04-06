# 📂 GCP Drive Manager

[![Deploy to GitHub Pages](https://github.com/aman-syed/gcp-drive/actions/workflows/deploy.yml/badge.svg)](https://github.com/aman-syed/gcp-drive/actions/workflows/deploy.yml)
[![Hosted on GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-blue?logo=github)](https://aman-syed.github.io/gcp-drive/)

A **secure, static, and client‑side** Google Cloud Platform (GCP) Drive manager. This tool allows you to connect using your own Service Account JSON and manage Drive assets without any backend dependency.

---

## ✨ Features

- **🚀 Static & Swift:** Built with Vite + React 19, deployable to GitHub Pages with zero server setup.
- **🔐 Client-Side Auth:** Uses the Browser's **Web Crypto API** to sign JWTs and request Google OAuth tokens directly. Your credentials never leave your browser.
- **📁 File Exploration:** List, search, and view Google Drive files and spreadsheets accessible to your Service Account.
- **🛡️ Access Management:** Easily "Remove My Access" for any file, cleaning up permissions for your service account with one click.
- **🎨 Premium UI:** Modern, responsive design using TailwindCSS, Lucide icons, and Motion animations.

---

## 🛠️ Getting Started

### 1. Prerequisites
To use this manager, you need a Google Cloud Service Account with the following:
- **APIs Enabled:** `Google Drive API` and `Google Sheets API`.
- **JSON Key:** Generate a JSON key for your service account from the [GCP Console](https://console.cloud.google.com/iam-admin/serviceaccounts).
- **Permissions:** Share the files or folders you want to manage with the Service Account's email address (e.g., `account-name@project-id.iam.gserviceaccount.com`).

### 2. Connect
1. Visit the deployed app.
2. Paste your **Service Account JSON** into the setup screen.
3. Click **Connect to GCP**.
4. The JSON is stored in your browser's `localStorage` for convenience and persistence.

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

---

## 📦 Deployment

This project is configured to deploy to **GitHub Pages** using GitHub Actions.

1. Fork or clone this repository.
2. Update the `base` path in `vite.config.ts` to match your repository name:
   ```ts
   base: '/your-repo-name/',
   ```
3. Push to the `main` branch.
4. The [Deploy Action](.github/workflows/deploy.yml) will build and publish your site automatically.

---

## 📑 Security & Privacy

> [!IMPORTANT]
> **This is a static tool.** All processing, including signing authentication tokens and communicating with Google APIs, happens **locally in your browser tab**.
> - **No Server Logs:** No backend means your Service Account JSON or file list is never sent to a third-party server.
> - **Local Storage:** Your credentials are saved in your browser's `localStorage` (if you choose to connect) and remain there until you click **Logout**.
> - **Open Source:** You can audit the code in `src/googleAuth.ts` and `src/App.tsx` to verify the security of the signing process.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
