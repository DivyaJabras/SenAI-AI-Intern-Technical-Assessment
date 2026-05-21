"""
SenAI CRM - Email Streaming Simulator
======================================
Reads email-data-advanced.json and streams each email to the
POST /api/ingest endpoint, simulating a real-time email feed.

Usage (from root directory, with venv activated):
    python simulate_stream.py                      # Default: 1s delay
    python simulate_stream.py --delay 0.5          # Faster: 0.5s delay
    python simulate_stream.py --fast               # No delay (bulk load)
    python simulate_stream.py --file my_emails.json
    python simulate_stream.py --start 10 --count 5 # Ingest emails 10-14
"""

import json
import sys
import time
import argparse
import urllib.request
import urllib.error

# Force UTF-8 output on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

API_URL = "http://localhost:8000/api/ingest"
DEFAULT_FILE = "email-data-advanced.json"

# ANSI color codes
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def post_email(email: dict) -> dict:
    data = json.dumps(email).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return {"error": f"HTTP {e.code}", "detail": body}
    except urllib.error.URLError as e:
        return {"error": f"Connection failed: {e.reason}"}

def main():
    parser = argparse.ArgumentParser(description="SenAI CRM Email Simulator")
    parser.add_argument("--file",  default=DEFAULT_FILE, help="Path to email JSON file")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay in seconds between emails")
    parser.add_argument("--fast",  action="store_true", help="No delay - bulk load all emails")
    parser.add_argument("--start", type=int, default=0, help="Start index (0-based)")
    parser.add_argument("--count", type=int, default=None, help="Number of emails to send (default: all)")
    args = parser.parse_args()

    delay = 0.0 if args.fast else args.delay

    print(f"\n{BOLD}{CYAN}+==========================================+{RESET}")
    print(f"{BOLD}{CYAN}|   SenAI CRM  -  Email Stream Simulator  |{RESET}")
    print(f"{BOLD}{CYAN}+==========================================+{RESET}\n")

    try:
        with open(args.file, "r", encoding="utf-8") as f:
            emails = json.load(f)
    except FileNotFoundError:
        print(f"{RED}Error: File '{args.file}' not found.{RESET}")
        sys.exit(1)

    slice_end = (args.start + args.count) if args.count else None
    emails_to_send = emails[args.start:slice_end]

    total = len(emails_to_send)
    print(f"  File     : {args.file}")
    print(f"  Emails   : {total} (indices {args.start} – {args.start + total - 1})")
    print(f"  Endpoint : {API_URL}")
    print(f"  Delay    : {'none (fast mode)' if args.fast else f'{delay}s'}")
    print()

    ok_count = 0
    dup_count = 0
    err_count = 0

    for i, email in enumerate(emails_to_send, 1):
        msg_id  = email.get("message_id", "?")
        sender  = email.get("sender", "?")
        subject = email.get("subject", "?")[:55]

        print(f"  [{i:>3}/{total}] {BOLD}{msg_id}{RESET} — {sender}")
        print(f"         Subject : {subject}")

        response = post_email(email)

        if "error" in response:
            print(f"         Status  : {RED}ERROR – {response['error']}{RESET}")
            if "detail" in response:
                print(f"         Detail  : {response['detail'][:120]}")
            err_count += 1
        else:
            data   = response.get("data", {})
            status = data.get("status", "unknown")
            if status == "queued":
                print(f"         Status  : {GREEN}✓ Queued{RESET}")
                ok_count += 1
            elif status == "duplicate":
                print(f"         Status  : {YELLOW}⚠ Duplicate (skipped){RESET}")
                dup_count += 1
            else:
                print(f"         Status  : {CYAN}{status}{RESET}")
                ok_count += 1

        print()
        if delay > 0 and i < total:
            time.sleep(delay)

    print(f"{BOLD}{'─'*46}{RESET}")
    print(f"  Done!  ✓ {GREEN}{ok_count} ingested{RESET}  "
          f"⚠ {YELLOW}{dup_count} duplicate{RESET}  "
          f"✗ {RED}{err_count} error{RESET}")
    print()
    print(f"  Open your dashboard: {CYAN}http://localhost:3000{RESET}")
    print(f"  Backend API docs   : {CYAN}http://localhost:8000/docs{RESET}\n")

if __name__ == "__main__":
    main()
