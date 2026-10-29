# FIM-IPL Frontend

React + TypeScript + Vite dashboard for the FIM-IPL backend. The interface is
designed for an operator who needs to answer three questions quickly:

1. Is monitoring running?
2. Did a file change, and was it quarantined?
3. Is the audit ledger still verifiable?

## Requirements

- Node.js LTS.
- A running FIM-IPL backend.

## Development

From the repository root, the recommended command is:

```powershell
.\dev.ps1
```

For Linux/WSL/VPS:

```bash
../dev.sh
```

To run the frontend alone:

```bash
npm install
npm run dev
```

The Vite proxy reads the backend `server_port` from `../backend/data/config.json`.
Set `FIM_API_PORT` to override it. The dashboard is available at
`http://localhost:3000`.

## Production Build

```bash
npm ci
npm run lint
npm run build
npm run preview
```

`dist/` is generated output and is intentionally ignored by Git.

## Dashboard Areas

- **Dashboard:** baseline status, scan performance, current quarantine state,
  realtime connection state, and recent anomalies.
- **Audit Trail:** paginated blocks, action filters, search, export, chain
  verification, block detail, and audited quarantine release.
- **Settings:** monitoring, maintenance mode, baseline operations, Telegram,
  backup, and Auditor account management.
- **System:** runtime information, worker configuration, watch paths, and
  security posture.

## Security Notes

- The frontend never receives the stored Telegram bot token from the backend.
- Bearer JWT authentication is used for API and SSE requests.
- For this local thesis demo, the JWT is stored in `localStorage`. Production
  deployment should move the token to a secure `HttpOnly`, `Secure`, `SameSite`
  cookie and serve the dashboard over HTTPS.
- Keep the dashboard on a separate origin from the monitored WordPress site to
  reduce the impact of a web application XSS issue.

## Design Principles

- Operational Indonesian copy is concise and specific; English is available
  through the language toggle.
- No decorative claim is presented as a security guarantee. The UI reports
  actual scan, quarantine, and ledger states.
- SSE is the primary realtime path. Polling is only a fallback when SSE is
  disconnected.
