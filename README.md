# Ghar Ledger

Daily household vendor tracking (milk, newspaper, maid, tuition, …) and the monthly totals they add up
to — for `ghar.keshavsingh.in`, part of the keshavsingh.in family of apps.

## Architecture

This app is deliberately a thin **resource server + SSO consumer**, not a new identity system:

- **Auth**: no local login. Users sign in once at the central identity provider
  (`admin.keshavsingh.in`); this app's API only *validates* the JWT that flow produces (same
  `Jwt:Issuer` / `Jwt:Audience` / `Jwt:SigningKey` as every other `*.keshavsingh.in` app — see
  `backend/GharLedger.Api/Program.cs`). The frontend exchanges the shared SSO cookie for an access
  token via `POST {idpUrl}/sso/session`, exactly like `content-blog`'s admin console does.
- **Roles**: reuses `KeshavSingh.Core.Roles` (`Admin`/`Editor`/`Viewer`) — no new role system.
- **Groups**: a lightweight `Household` (this app's own domain model — members are just SSO user
  ids) rather than reusing admin's `Group`/`CustomRole`/`WebsiteGrant` RBAC, which is specific to
  admin's own screens.
- **Data**: `KeshavSingh.Mongo.NoSql`, its own `GharLedgerDb` database.

## Project layout

- `backend/GharLedger.Api` — ASP.NET Core 10 Web API (Households, Vendors, Daily entries).
- `frontend` — Angular 22 app, deployed to GitHub Pages (see `.github/workflows/deploy-frontend.yml`).

## Local development

Backend:

```powershell
cd backend/GharLedger.Api
dotnet run
```

Needs a local MongoDB (`appsettings.Development.json` points at `mongodb://localhost:27017`) and,
for a real sign-in round trip, admin's backend running locally too (same `Jwt:SigningKey`).

Frontend:

```powershell
cd frontend
npm install
npm start
```

## Deployment

- **Frontend**: GitHub Pages, via `.github/workflows/deploy-frontend.yml` (push to `master`).
- **Backend**: Render, via `render.yaml` (Docker build from `backend/Dockerfile`). Set
  `Jwt__SigningKey` in the Render dashboard to the **exact same value** as admin's — otherwise
  tokens minted by admin won't validate here.
