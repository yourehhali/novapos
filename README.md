# NovaPOS Demo Setup

This repo contains the first NovaPOS implementation slice:

- Spring Boot backend in `api/`
- Angular offline-first frontend in `appfront/`
- Seeded demo accounts, branches, products, printer targets, and sync-ready flows

This README is the quickest way to start the app and test the current vertical slice.

## Desktop POS Build

NovaPOS now includes an Electron desktop shell in `appfront/` so the POS can print through the local machine without stopping on the Chrome print dialog when running as a desktop app.

- macOS desktop dev: `cd appfront && npm run desktop:dev`
- macOS package: `cd appfront && npm run desktop:package:mac`
- Windows `.exe` package: built in GitHub Actions from `.github/workflows/desktop-build.yml`

The workflow builds:

- Windows `nsis` installer and `portable` executable on `windows-latest`
- macOS `dmg` and `zip` packages on `macos-latest`

Artifacts are uploaded from `appfront/release/` in each Actions run.

## What Is Seeded Right Now

### Demo Business

- Business: `Atlas Bites Group`
- Tenant ID: `tenant-atlas-bites`

### Demo Branches

| Branch | Branch ID | Code | Timezone |
|---|---|---|---|
| Oujda Flagship | `branch-oujda` | `OUJDA` | `Africa/Casablanca` |
| Rabat Express | `branch-rabat` | `RABAT` | `Africa/Casablanca` |

### Demo Accounts

All demo users use the same password:

```text
Pass123!
```

| Role | Email | Default Branch Access |
|---|---|---|
| Super Admin | `superadmin@novapos.ma` | Oujda, Rabat |
| Business Owner | `owner@novapos.ma` | Oujda, Rabat |
| Manager | `manager@novapos.ma` | Oujda |
| Cashier | `cashier@novapos.ma` | Oujda |
| Waiter | `waiter@novapos.ma` | Oujda |
| Kitchen | `kitchen@novapos.ma` | Oujda |
| Inventory Manager | `inventory@novapos.ma` | Oujda, Rabat |
| Accountant | `accountant@novapos.ma` | Rabat |

### Demo Product Categories

- BURGERS
- SMASH BURGERS
- PASTICCIO
- POUTINE
- PANOZZOS
- PIZZA BOAT
- TACOS
- FRIES
- DRINKS
- TAPAS
- SALADES
- EXTRAS
- GLOVO

### Demo Products

| SKU | Product | Category | Price |
|---|---|---|---|
| `BRG-001` | TWIN GUACAMOLE | BURGERS | `67.00 DH` |
| `SMB-001` | DOUBLE SMASH BIG BOSS | SMASH BURGERS | `65.00 DH` |
| `PAS-001` | DIEGO | PASTICCIO | `41.00 DH` |
| `POU-001` | QUEBECOIS | POUTINE | `29.00 DH` |
| `PNZ-001` | AMIGO | PANOZZOS | `43.00 DH` |
| `PBT-001` | PEPPERONI | PIZZA BOAT | `48.00 DH` |
| `TAC-001` | POULET ET CHAMPIGNONS | TACOS | `47.00 DH` |
| `FRI-001` | FRITES | FRIES | `8.00 DH` |
| `DRK-007` | ESPRESSO | DRINKS | `8.00 DH` |
| `TAP-001` | GUACAMOLE CON NACHOS | TAPAS | `25.00 DH` |
| `SAL-003` | BURRATA | SALADES | `65.00 DH` |
| `EXT-001` | SAUCE HOLEMOLE | EXTRAS | `5.00 DH` |
| `GLV-006` | COMBO M | GLOVO | `142.00 DH` |

### Demo Printer Targets

| Name | Target | Protocol | Queue |
|---|---|---|---|
| Front Counter Receipt | `RECEIPT` | `ESC_POS` | `EPSON TM-T20II Receipt` |
| Kitchen Hot Line | `KITCHEN` | `ESC_POS` | `EPSON TM-T20II Receipt` |

Desktop printing metadata also flows with each printer config:

- `paperWidthMm`
- `charactersPerLine`
- `printMode`
- `silent`
- `systemPrinterName`

## How To Run It

### One Command Startup

From the repo root:

```bash
./start.sh
```

What it does:

- checks for Java, Node, npm, and `lsof`
- verifies Java `21` before starting the backend
- installs frontend dependencies automatically if `appfront/node_modules` is missing
- starts the backend on `8080`
- starts the frontend on `4200`
- writes runtime logs to `.run/api.log` and `.run/appfront.log`

If the script refuses to start, the most likely cause is that your shell is still using Java `17` instead of Java `21`.

### Backend

The backend is configured for:

- Java `21`
- Spring Boot `3`
- in-memory H2 for local development

Run:

```bash
cd api
./mvnw spring-boot:run
```

Backend URL:

```text
http://localhost:8080
```

Important note: this machine currently has Java 17 installed, but the project is configured for Java 21. If `spring-boot:run` fails locally, install or switch to Java 21 first.

### Frontend

Run:

```bash
cd appfront
npm install
npm start
```

Frontend URL:

```text
http://localhost:4200
```

### Desktop App

Run the Angular app inside Electron:

```bash
cd appfront
npm install
npm run desktop:dev
```

Create a local macOS package:

```bash
cd appfront
npm run desktop:package:mac
```

The packaged artifacts are written to:

```text
appfront/release/
```

## Quick Test Flow

If you just want to see the app working end to end, use this path:

1. Start the backend on `http://localhost:8080`
2. Start the desktop app with `cd appfront && npm run desktop:dev`
3. Log in with:

```text
cashier@novapos.ma
Pass123!
```

4. Pick branch `Oujda Flagship`
5. Leave device type as `POS_TERMINAL`
6. Open the POS page
7. Add 2-3 demo products
8. Click `Prepare`
9. Open `Order History`
10. Pay the prepared order
11. Confirm that:
   - the cart clears
   - a kitchen ticket prints on prepare without the browser print dialog in desktop mode
   - a payment ticket prints on pay without the browser print dialog in desktop mode
   - the last order card appears
   - sync status updates when online

## Suggested Smoke Tests

### 1. Login Test

- Try `cashier@novapos.ma / Pass123!`
- Try `owner@novapos.ma / Pass123!`
- Try an invalid password and confirm login is rejected

### 2. Branch Bootstrap Test

- Log in as owner
- Confirm both branches appear
- Select `Rabat Express`
- Confirm the shell shows the selected branch name and generated device code

### 3. Catalog Test

- Open POS
- Search for `Bigboss`
- Search for `SMB-001`
- Switch category filters and confirm product cards update

### 4. Checkout Test

- Add `Double Smash Bigboss`
- Add `Frites`
- Prepare the order
- Open order history and pay it
- Confirm the last order card appears
- Confirm desktop mode prints silently to the configured printer or falls back to the browser only outside Electron

### 5. Offline Queue Test

- Start backend and frontend
- Log in and bind a branch
- Stop backend
- Create and complete a sale in the POS
- Confirm the UI still works locally
- Restart backend
- Use manual sync from Settings

### 6. Role Visibility Test

Use these accounts and confirm navigation/scope changes:

- `superadmin@novapos.ma`
- `owner@novapos.ma`
- `manager@novapos.ma`
- `cashier@novapos.ma`
- `inventory@novapos.ma`
- `accountant@novapos.ma`

## API Endpoints You Can Hit Manually

### Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"cashier@novapos.ma","password":"Pass123!"}'
```

### Products

Use the access token from login:

```bash
curl http://localhost:8080/api/catalog/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Sync Test

```bash
curl -X POST http://localhost:8080/api/sync/events \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId":"branch-oujda",
    "deviceId":"device-oujda-01",
    "events":[
      {
        "eventUuid":"evt-demo-001",
        "tenantId":"tenant-atlas-bites",
        "branchId":"branch-oujda",
        "deviceId":"device-oujda-01",
        "deviceSequence":1,
        "timestamp":"2026-07-25T16:20:00Z",
        "eventType":"OrderCreated",
        "aggregateType":"ORDER",
        "aggregateId":"order-demo-001",
        "aggregateVersion":1,
        "schemaVersion":1,
        "status":"PENDING",
        "payload":{"total":36}
      }
    ]
  }'
```

## Current Demo Limitations

- The backend currently serves seeded sample data rather than persistent JPA-backed business records
- Local development uses H2, not PostgreSQL yet
- Backend tests require Java 21 to run locally
- Windows packaging is produced through GitHub Actions because this workstation is macOS-based
- Kitchen, inventory, and purchasing are not fully implemented yet; the current slice focuses on auth, branch bootstrap, POS checkout, offline queueing, and sync foundation

## Best Demo Accounts To Start With

If you want the fastest path:

- `cashier@novapos.ma` for POS testing
- `owner@novapos.ma` for branch switching and admin screens
- `inventory@novapos.ma` for broader role coverage
