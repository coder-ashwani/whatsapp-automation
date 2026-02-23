# WhatsApp Automation (Frontend + Backend)

This project now includes:

- **Backend**: Node.js + Express API with `whatsapp-web.js` for real WhatsApp account connectivity.
- **Frontend**: Simple web dashboard to connect your account and schedule messages.

You can add your WhatsApp account by scanning the QR code once, then it stays logged in with local session storage.

## Features

- Connect your own WhatsApp account from browser UI.
- See live account state (`qr_required`, `authenticated`, `ready`, etc.).
- Schedule messages with receiver, message, and date/time.
- Automatically send pending messages at scheduled time.
- View sent/failed/pending history.

## Tech stack

- `express` for backend API and static frontend hosting.
- `whatsapp-web.js` with `LocalAuth` for seamless account reuse.
- `socket.io` for live account/QR updates in UI.
- Local JSON storage (`data/schedules.json`) for schedules.

## 1) Install

```bash
npm install
```

## 2) Run

```bash
npm start
```

Open:

- `http://localhost:3000`

## 3) Add your WhatsApp account

1. Start the app.
2. Open the dashboard.
3. When QR appears, scan it using WhatsApp on your phone:
   - WhatsApp → Linked devices → Link a device.
4. Status changes to `ready` when connected.

> Session is stored locally by `LocalAuth`, so you usually do not need to scan QR every time.

## API summary

- `GET /api/account-status` → current WhatsApp connection status.
- `GET /api/schedules` → list schedules.
- `POST /api/schedules` → add a schedule:

```json
{
  "to": "+14155552671",
  "message": "Hello from scheduler",
  "sendAt": "2026-02-20T18:30:00.000Z"
}
```

- `DELETE /api/schedules/:id` → delete a pending schedule.

## Notes

- Keep server running for scheduled sends to happen.
- Keep internet stable on machine running backend.
- Phone number can include `+`; backend normalizes it.
- WhatsApp platform changes can occasionally affect automation libraries.
