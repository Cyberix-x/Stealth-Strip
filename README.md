# StealthStrip 🛡️

> Free, private image metadata remover MERN-lite on Vercel

---
## Live Demo
https://stealth-strip.vercel.app

## Stack
| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + Lucide |
| EXIF Analysis | `exifreader` (client-side, zero upload needed for scan) |
| Metadata Stripping | `sharp` (Vercel Serverless Function) |
| Database | MongoDB Atlas + Mongoose (global counter) |
| Hosting | Vercel (frontend + serverless API) |

---

## File Structure

```
stealthstrip/
├── api/
│   └── strip.js          ← Serverless function (sharp + MongoDB)
├── lib/
│   ├── db.js             ← MongoDB connection singleton
│   └── models/
│       └── Counter.js    ← Mongoose model
├── src/
│   ├── App.jsx           ← Main React app
│   ├── main.jsx          ← Entry point
│   └── index.css         ← Tailwind + custom styles
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json           ← Serverless routing config
└── package.json
```

---

## How It Works

1. **Client-side scan** — `exifreader` reads EXIF tags in the browser without uploading
2. **Risk Assessment** — 🔴 GPS found / 🟡 Camera+Date found / 🟢 Clean
3. **Server strip** — `POST /api/strip` sends the file to `sharp` which re-encodes the image without any metadata.
4. **Counter** — MongoDB Atlas increments `totalFilesProcessed` on every successful strip.
5. **Download** — A Blob URL is created client-side for instant one-click download.

---

## Environment Variables

| Key | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |

Add in Vercel: **Project → Settings → Environment Variables**
