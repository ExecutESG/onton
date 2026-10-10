#!/usr/bin/env python3
"""
Test Suite for ONTON Backup & Disaster Recovery Scripts
Verifies retention policy algorithms, script argument parsing, dry-run safety,
and error handling.
"""

import unittest
import subprocess
import os
import json
from datetime import datetime, timedelta

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "devops/backup_scripts")
RETENTION_SCRIPT = os.path.join(SCRIPTS_DIR, "retention_policy.py")
BACKUP_SCRIPT = os.path.join(SCRIPTS_DIR, "backup_to_hetzner.sh")
RESTORE_SCRIPT = os.path.join(SCRIPTS_DIR, "restore_from_hetzner.sh")

class TestBackupRetentionPolicy(unittest.TestCase):
    def test_retention_bucketing(self):
        """Verify 7 daily, 4 weekly, 3 monthly snapshots over 120 days."""
        base_time = datetime(2026, 10, 10, 2, 0, 0)
        files = []
        for days_ago in range(120):
            dt = base_time - timedelta(days=days_ago)
            files.append(f"db_dump_{dt.strftime('%Y-%m-%d_%H-%M-%S')}.sql.gz")

        cmd = [
            "python3", RETENTION_SCRIPT,
            "--action=json",
            "--now=2026-10-10_02-00-00"
        ] + files

        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        result = json.loads(proc.stdout)

        self.assertEqual(result["total"], 120)
        # Expected kept: 8 daily (day 0 to 7 inclusive) + 4 weekly (days 8-35) + 2-3 monthly (days 36-90)
        self.assertGreaterEqual(result["kept"], 13)
        self.assertLessEqual(result["kept"], 16)
        self.assertEqual(result["kept"] + result["deleted"], 120)

    def test_safety_guard_few_backups(self):
        """Ensure script never prunes when <= 3 backups exist, regardless of age."""
        old_files = [
            "db_dump_2025-01-01_02-00-00.sql.gz",
            "db_dump_2025-01-02_02-00-00.sql.gz"
        ]
        cmd = [
            "python3", RETENTION_SCRIPT,
            "--action=json",
            "--now=2026-10-10_02-00-00"
        ] + old_files

        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        result = json.loads(proc.stdout)

        self.assertEqual(result["deleted"], 0)
        self.assertEqual(result["kept"], 2)

    def test_unparseable_files_preserved(self):
        """Ensure arbitrary or unparseable files are not deleted."""
        mixed_files = [
            "db_dump_2026-10-09_02-00-00.sql.gz",
            "custom_snapshot.sql",
            "random_notes.txt"
        ]
        cmd = [
            "python3", RETENTION_SCRIPT,
            "--action=json",
            "--now=2026-10-10_02-00-00"
        ] + mixed_files

        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        result = json.loads(proc.stdout)

        self.assertIn("custom_snapshot.sql", result["unparseable"])
        self.assertIn("random_notes.txt", result["unparseable"])
        self.assertEqual(result["deleted"], 0)

    def test_encrypted_and_files_extensions(self):
        """Ensure .enc extensions and files_dump prefixes are parsed correctly."""
        files = [
            "db_dump_2026-10-10_02-00-00.sql.gz.enc",
            "files_dump_2026-10-10_03-00-00.tar.gz.enc",
            "db_dump_2026-06-01_02-00-00.sql.gz.enc"
        ]
        cmd = [
            "python3", RETENTION_SCRIPT,
            "--action=json",
            "--now=2026-10-10_02-00-00"
        ] + files

        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        result = json.loads(proc.stdout)
        self.assertEqual(result["unparseable_count"], 0)
        self.assertEqual(result["total"], 3)

    def test_cli_summary_mode(self):
        """Verify human-readable summary mode."""
        files = [
            "db_dump_2026-10-10_02-00-00.sql.gz",
            "db_dump_2026-10-09_02-00-00.sql.gz"
        ]
        cmd = [
            "python3", RETENTION_SCRIPT,
            "--action=summary",
            "--now=2026-10-10_02-00-00"
        ] + files

        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        self.assertIn("Total files:    2", proc.stdout)
        self.assertIn("Retained:       2", proc.stdout)

class TestBackupScriptsCLI(unittest.TestCase):
    def test_backup_missing_credentials(self):
        """Ensure backup script fails cleanly when credentials are missing."""
        env = os.environ.copy()
        env.pop("HETZNER_STORAGE_USER", None)
        env.pop("HETZNER_STORAGE_PASS", None)
        # Empty env file dummy
        proc = subprocess.run(
            [BACKUP_SCRIPT, "db-only"],
            capture_output=True,
            text=True,
            env=env
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("HETZNER_STORAGE_USER", proc.stdout + proc.stderr)

    def test_restore_help_flag(self):
        """Ensure restore script handles --help cleanly."""
        proc = subprocess.run(
            [RESTORE_SCRIPT, "--help"],
            capture_output=True,
            text=True
        )
        self.assertEqual(proc.returncode, 0)
        self.assertIn("Usage:", proc.stdout)

    def test_restore_missing_credentials(self):
        """Ensure restore script checks credentials before attempting operations."""
        env = os.environ.copy()
        env.pop("HETZNER_STORAGE_USER", None)
        env.pop("HETZNER_STORAGE_PASS", None)
        proc = subprocess.run(
            [RESTORE_SCRIPT, "--latest"],
            capture_output=True,
            text=True,
            env=env
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("HETZNER_STORAGE_USER", proc.stdout + proc.stderr)

if __name__ == "__main__":
    unittest.main()
