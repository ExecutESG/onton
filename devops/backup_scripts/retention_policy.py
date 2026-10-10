#!/usr/bin/env python3
"""
ONTON Backup Retention Policy Engine
Calculates which backup files to retain and which to prune based on:
- Daily: Keep all snapshots for the last 7 days (days 0-7)
- Weekly: Keep 1 snapshot per calendar week for days 8-35 (up to 4 weekly snapshots)
- Monthly: Keep 1 snapshot per calendar month for days 36-90 (up to 3 monthly snapshots)
- Purge: All snapshots older than 90 days

Usage:
    python3 retention_policy.py [--delete|--keep|--summary] [--now YYYY-MM-DD] [files...]
    cat backup_list.txt | python3 retention_policy.py --delete
"""

import sys
import os
import re
import argparse
import json
from datetime import datetime, timezone

DATE_PATTERN = re.compile(r'(?:db_dump|files_dump)_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})')

def parse_backup_date(filename):
    basename = os.path.basename(filename.strip())
    m = DATE_PATTERN.search(basename)
    if not m:
        m_date = re.search(r'(\d{4}-\d{2}-\d{2})', basename)
        if m_date:
            try:
                return datetime.strptime(m_date.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                return None
        return None
    date_str, time_str = m.group(1), m.group(2)
    try:
        return datetime.strptime(f"{date_str}_{time_str}", "%Y-%m-%d_%H-%M-%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None

def evaluate_retention(files, reference_time=None, daily_days=7, weekly_days=35, monthly_days=90):
    if reference_time is None:
        reference_time = datetime.now(timezone.utc)

    parsed_files = []
    unparseable = []

    for f in files:
        f = f.strip()
        if not f:
            continue
        dt = parse_backup_date(f)
        if dt:
            parsed_files.append((dt, f))
        else:
            unparseable.append(f)

    # Sort descending by date (newest first)
    parsed_files.sort(key=lambda x: x[0], reverse=True)

    keep = []
    delete = []

    weekly_buckets = {}   # (iso_year, iso_week) -> kept filename
    monthly_buckets = {}  # (year, month) -> kept filename

    for dt, filename in parsed_files:
        age_days = (reference_time - dt).total_seconds() / 86400.0

        if age_days < 0:
            # Future snapshot or clock skew: keep for safety
            keep.append(filename)
        elif age_days <= daily_days:
            # Days 0-7: keep all daily snapshots
            keep.append(filename)
        elif age_days <= weekly_days:
            # Days 8-35: keep 1 snapshot per week
            iso_year, iso_week, _ = dt.isocalendar()
            week_key = (iso_year, iso_week)
            if week_key not in weekly_buckets:
                weekly_buckets[week_key] = filename
                keep.append(filename)
            else:
                delete.append(filename)
        elif age_days <= monthly_days:
            # Days 36-90: keep 1 snapshot per month
            month_key = (dt.year, dt.month)
            if month_key not in monthly_buckets:
                monthly_buckets[month_key] = filename
                keep.append(filename)
            else:
                delete.append(filename)
        else:
            # Older than 90 days: delete
            delete.append(filename)

    # Safety guard: Never delete everything if total parsed snapshots is <= 3
    if len(parsed_files) <= 3:
        keep = [f for _, f in parsed_files]
        delete = []

    return delete, keep, unparseable

def main():
    parser = argparse.ArgumentParser(description="Calculate backup retention pruning.")
    parser.add_argument("files", nargs="*", help="File names or paths to evaluate (reads stdin if none given)")
    parser.add_argument("--action", choices=["delete", "keep", "summary", "json"], default="delete",
                        help="Action output mode (default: delete)")
    parser.add_argument("--now", help="Reference date in YYYY-MM-DD or YYYY-MM-DD_HH-MM-SS format (for testing)")
    parser.add_argument("--daily", type=int, default=7, help="Days to keep all daily snapshots (default: 7)")
    parser.add_argument("--weekly", type=int, default=35, help="Days to keep weekly snapshots (default: 35)")
    parser.add_argument("--monthly", type=int, default=90, help="Days to keep monthly snapshots (default: 90)")

    args = parser.parse_args()

    files = args.files
    if not files:
        if not sys.stdin.isatty():
            files = [line.strip() for line in sys.stdin if line.strip()]
        else:
            files = []

    if not files:
        if args.action == "json":
            print(json.dumps({"total": 0, "kept": 0, "deleted": 0, "delete": [], "keep": []}))
        sys.exit(0)

    ref_time = None
    if args.now:
        try:
            if "_" in args.now:
                ref_time = datetime.strptime(args.now, "%Y-%m-%d_%H-%M-%S").replace(tzinfo=timezone.utc)
            else:
                ref_time = datetime.strptime(args.now, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            sys.stderr.write(f"Invalid --now date: {args.now}\n")
            sys.exit(1)

    delete, keep, unparseable = evaluate_retention(
        files,
        reference_time=ref_time,
        daily_days=args.daily,
        weekly_days=args.weekly,
        monthly_days=args.monthly
    )

    if args.action == "delete":
        for item in delete:
            print(item)
    elif args.action == "keep":
        for item in keep:
            print(item)
    elif args.action == "summary":
        print(f"Total files:    {len(files)}")
        print(f"Retained:       {len(keep)}")
        print(f"To delete:      {len(delete)}")
        if unparseable:
            print(f"Unparseable:    {len(unparseable)} (preserved)")
    elif args.action == "json":
        print(json.dumps({
            "total": len(files),
            "kept": len(keep),
            "deleted": len(delete),
            "unparseable_count": len(unparseable),
            "unparseable": unparseable,
            "delete": delete,
            "keep": keep
        }, indent=2))

if __name__ == "__main__":
    main()
