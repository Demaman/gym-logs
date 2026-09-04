# Deployment Guide — Homologation (Render + Neon + Upstash)

**Stack:** Render (API + Frontend) · Neon (PostgreSQL) · Upstash (Redis)
**Cost:** Free tier on all three — no credit card required.
**Trade-off:** Services sleep after 15 min idle. First request after sleep takes ~30 s.

---

## Prerequisites

- GitHub account with this repo pushed to it
- Accounts on: [render.com](https://render.com), [neon.tech](https://neon.tech), [upstash.com](https://upstash.com)

---

## Step 1 — Push to GitHub

```bash
# On github.com: create a new PRIVATE repo named "gym-logs", then:
git remote add origin https://github.com/<your-username>/gym-logs.git
git push -u origin master
```

---

## Step 2 — PostgreSQL on Neon

1. Go to [console.neon.tech](https://console.neon.tech) → **New Project**
2. Name: `gym-logs` · Region: closest to your users
3. Click **Create project**
4. Copy the **Connection string** — it looks like:
   ```
   postgresql://gymlogs:<password>@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. **Change the driver** for asyncpg: replace `postgresql://` with `postgresql+asyncpg://`
   ```
   postgresql+asyncpg://gymlogs:<password>@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   Save this — you'll need it in Step 4.

---

## Step 3 — Redis on Upstash

1. Go to [console.upstash.com](https://console.upstash.com) → **Create Database**
2. Name: `gym-logs` · Type: Regional · Region: same as Neon
3. Click **Create**
4. In the database page, copy the **Redis URL** under **REST** → it starts with `redis://`
   Make sure to use the `rediss://` (TLS) URL — it looks like:
   ```
   rediss://default:<password>@<host>.upstash.io:6379
   ```
   Save this.

---

## Step 4 — Backend API on Render

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Web Service**
2. Connect your GitHub repo
3. Settings:
   | Field | Value |
   |---|---|
   | Name | `gym-logs-api` |
   | Root Directory | `backend` |
   | Environment | **Docker** |
   | Branch | `master` |
   | Plan | Free |

4. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your Neon `postgresql+asyncpg://...` string |
   | `REDIS_URL` | your Upstash `rediss://...` string |
   | `SECRET_KEY` | generate one: `python -c "import secrets; print(secrets.token_hex(32))"` |
   | `ALGORITHM` | `HS256` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
   | `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
   | `CORS_ORIGINS` | `https://gym-logs-frontend.onrender.com` ← update after Step 5 |
   | `MEDIA_BASE_URL` | `https://gym-logs-api.onrender.com` |

5. Click **Create Web Service**
6. Wait for the first deploy (~3–5 min). Watch the logs — you should see:
   ```
   Running database migrations...
   INFO  [alembic] Running upgrade ...
   Starting application...
   INFO  Application startup complete.
   ```
7. Note your API URL: `https://gym-logs-api.onrender.com`

---

## Step 5 — Frontend on Render

1. **New → Web Service** → same repo
2. Settings:
   | Field | Value |
   |---|---|
   | Name | `gym-logs-frontend` |
   | Root Directory | `frontend` |
   | Environment | **Node** |
   | Build Command | `pnpm install && pnpm build` |
   | Start Command | `pnpm start` |
   | Plan | Free |

3. Environment Variables:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://gym-logs-api.onrender.com` |

4. Click **Create Web Service**
5. Your frontend URL: `https://gym-logs-frontend.onrender.com`

---

## Step 6 — Update CORS on the Backend

1. Go back to your `gym-logs-api` service on Render
2. **Environment** tab → update `CORS_ORIGINS`:
   ```
   https://gym-logs-frontend.onrender.com
   ```
3. Render will auto-redeploy.

---

## Step 7 — Smoke test

Open `https://gym-logs-frontend.onrender.com`.

- First load may take 30 s (cold start). Subsequent loads are fast.
- Register an account → the API should respond.
- Check `https://gym-logs-api.onrender.com/health` → should return `{"status": "ok"}`.
- Check `https://gym-logs-api.onrender.com/docs` → FastAPI Swagger UI with all endpoints.

---

## Auto-deploy on push

Both services redeploy automatically on every `git push origin master`. No manual steps needed after initial setup.

---

## Optional — AI program generation

If you want the AI feature (program generator), set these on the API service:

| Key | Value |
|---|---|
| `AI_API_KEY` | Your Gemini API key from [aistudio.google.com](https://aistudio.google.com) (free) |
| `AI_MODEL` | `gemini-2.0-flash` |
| `AI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` |

Gemini has a free tier (15 req/min, 1M tokens/day) — sufficient for homologation.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Login fails with network error | Check `NEXT_PUBLIC_API_URL` matches your actual API URL exactly |
| API returns 500 on startup | Check Render logs — likely a `DATABASE_URL` format issue (must be `postgresql+asyncpg://`) |
| Migrations didn't run | Manually trigger redeploy on the API service |
| CORS error in browser console | `CORS_ORIGINS` on the API must exactly match the frontend URL (no trailing slash) |
| Redis connection refused | Confirm Upstash URL starts with `rediss://` (with double s, TLS) |

---

## Tear down

To stop billing (Render free tier is always free but to clean up):
1. Render: delete both services from the dashboard
2. Neon: delete the project
3. Upstash: delete the database
