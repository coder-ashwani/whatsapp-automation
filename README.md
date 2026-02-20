# whatsapp-automation

Schedule WhatsApp messages in advance and send them automatically at the exact time you choose.

## What this script does

- Reads a schedule from a JSON file.
- Waits until each message's `send_at` time.
- Opens WhatsApp Web and sends the message to the receiver.

> It uses your normal WhatsApp account through WhatsApp Web, so your system browser must be available.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Create your schedule

Copy the example file and edit it:

```bash
cp messages.example.json messages.json
```

JSON format:

```json
[
  {
    "phone": "+14155552671",
    "message": "Hello from scheduler",
    "send_at": "2026-02-20 18:30"
  }
]
```

### Rules

- `phone` must include country code and start with `+`.
- `send_at` format is `YYYY-MM-DD HH:MM`.
- Time is interpreted in your computer's local timezone.

## Run

```bash
python3 schedule_whatsapp.py --schedule messages.json
```

### Optional flags

- `--poll-seconds 20`: check interval for next scheduled send.
- `--wait-time 15`: how long to wait for WhatsApp Web before sending.
- `--keep-tabs-open`: keep WhatsApp tabs open after sends.
- `--close-after 3`: delay before closing each tab.

## Notes

- On first run, you may need to scan the WhatsApp Web QR code.
- Keep your machine awake and connected to internet while the scheduler is running.
- If a scheduled time has already passed, that message is skipped.
