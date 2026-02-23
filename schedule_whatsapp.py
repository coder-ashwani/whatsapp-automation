#!/usr/bin/env python3
"""Schedule WhatsApp messages from a JSON file."""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List

import pywhatkit


DATETIME_FORMAT = "%Y-%m-%d %H:%M"


@dataclass(order=True)
class ScheduledMessage:
    send_at: datetime
    phone: str
    message: str


def parse_schedule(path: Path) -> List[ScheduledMessage]:
    if not path.exists():
        raise FileNotFoundError(f"Schedule file not found: {path}")

    with path.open("r", encoding="utf-8") as schedule_file:
        raw_items = json.load(schedule_file)

    if not isinstance(raw_items, list):
        raise ValueError("Schedule file must contain a JSON array of message objects.")

    messages: List[ScheduledMessage] = []
    for index, item in enumerate(raw_items, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Entry #{index} must be an object.")

        missing = [key for key in ("phone", "message", "send_at") if key not in item]
        if missing:
            raise ValueError(f"Entry #{index} missing required fields: {', '.join(missing)}")

        try:
            send_at = datetime.strptime(item["send_at"], DATETIME_FORMAT)
        except ValueError as error:
            raise ValueError(
                f"Entry #{index} has invalid 'send_at'. Use format '{DATETIME_FORMAT}'."
            ) from error

        phone = str(item["phone"]).strip()
        message = str(item["message"])

        if not phone.startswith("+"):
            raise ValueError(f"Entry #{index} phone must include country code, e.g. +14155552671")

        if not message.strip():
            raise ValueError(f"Entry #{index} message cannot be empty.")

        messages.append(ScheduledMessage(send_at=send_at, phone=phone, message=message))

    if not messages:
        raise ValueError("No messages found in schedule file.")

    return sorted(messages)


def wait_until(target_time: datetime, poll_seconds: int) -> None:
    while True:
        now = datetime.now()
        remaining = (target_time - now).total_seconds()

        if remaining <= 0:
            return

        sleep_for = max(1, min(poll_seconds, int(remaining)))
        print(
            f"Waiting for {target_time.strftime(DATETIME_FORMAT)} "
            f"({int(remaining)}s remaining)..."
        )
        time.sleep(sleep_for)


def send_message(job: ScheduledMessage, wait_time: int, close_tab: bool, close_after: int) -> None:
    print(f"Sending message to {job.phone} scheduled for {job.send_at.strftime(DATETIME_FORMAT)}")
    pywhatkit.sendwhatmsg_instantly(
        phone_no=job.phone,
        message=job.message,
        wait_time=wait_time,
        tab_close=close_tab,
        close_time=close_after,
    )


def run_scheduler(messages: List[ScheduledMessage], poll_seconds: int, wait_time: int, close_tab: bool, close_after: int) -> None:
    for job in messages:
        if job.send_at < datetime.now():
            print(f"Skipping past schedule: {job.phone} at {job.send_at.strftime(DATETIME_FORMAT)}")
            continue

        wait_until(job.send_at, poll_seconds)
        send_message(job, wait_time, close_tab, close_after)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Send scheduled WhatsApp messages using WhatsApp Web."
    )
    parser.add_argument(
        "--schedule",
        default="messages.json",
        help="Path to schedule JSON file (default: messages.json)",
    )
    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=20,
        help="How often to check if it is time to send the next message.",
    )
    parser.add_argument(
        "--wait-time",
        type=int,
        default=15,
        help="Seconds to wait for WhatsApp Web before typing/sending message.",
    )
    parser.add_argument(
        "--keep-tabs-open",
        action="store_true",
        help="Do not close the WhatsApp tab after each message.",
    )
    parser.add_argument(
        "--close-after",
        type=int,
        default=3,
        help="Seconds to wait before closing the WhatsApp tab.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.poll_seconds <= 0:
        raise ValueError("--poll-seconds must be greater than 0.")

    schedule_path = Path(args.schedule)
    jobs = parse_schedule(schedule_path)

    print("Loaded schedule:")
    for job in jobs:
        print(f"- {job.send_at.strftime(DATETIME_FORMAT)} -> {job.phone}")

    print("\nKeep your internet connected and ensure WhatsApp Web can open in your default browser.")
    print("If this is your first run, scan the QR code when the browser opens.")

    run_scheduler(
        messages=jobs,
        poll_seconds=args.poll_seconds,
        wait_time=args.wait_time,
        close_tab=not args.keep_tabs_open,
        close_after=args.close_after,
    )


if __name__ == "__main__":
    main()
