import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from google_scholar_crawler import main as crawler


class ScholarFallbackTests(unittest.TestCase):
    def test_backend_import_failure_tries_next_backend(self):
        fresh = {"fetch_status": "fresh", "citedby": 2528}
        with (
            patch.object(crawler, "FETCH_ORDER", ("scholarly", "direct")),
            patch.object(crawler, "fetch_scholarly_stats", side_effect=AttributeError("typing.Union")),
            patch.object(crawler, "fetch_direct_profile_stats", return_value=fresh) as direct,
        ):
            self.assertEqual(crawler.fetch_fresh_stats("test-id", "now"), fresh)
            direct.assert_called_once_with("test-id", "now")

    def test_backend_crash_preserves_previous_metrics_and_timestamp(self):
        previous = {
            "citedby": 2528,
            "hindex": 20,
            "i10index": 26,
            "updated": "2026-11-09T18:39:09+00:00",
        }
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(crawler, "OUTPUT_DIR", Path(directory)),
            patch.object(crawler, "read_scholar_id", return_value="test-id"),
            patch.object(crawler, "FETCH_ORDER", ("direct", "scholarly_free_proxy", "scholarly")),
            patch.object(crawler, "fetch_direct_profile_stats", side_effect=RuntimeError("HTTP 403")),
            patch.object(crawler, "fetch_scholarly_stats", side_effect=AttributeError("typing.Union")),
            patch.object(crawler, "fetch_text", return_value=json.dumps(previous)),
        ):
            crawler.main()
            stats = json.loads((Path(directory) / "gs_data.json").read_text())
            for key, value in previous.items():
                self.assertEqual(stats[key], value)
            self.assertEqual(stats["fetch_status"], "stale")
            self.assertIn("HTTP 403", stats["fetch_error"])
            self.assertIn("AttributeError: typing.Union", stats["fetch_error"])
            badge = json.loads((Path(directory) / "gs_data_shieldsio.json").read_text())
            self.assertEqual(badge["message"], "2,528")

    def test_no_previous_data_still_fails(self):
        with (
            tempfile.TemporaryDirectory() as directory,
            patch.object(crawler, "OUTPUT_DIR", Path(directory)),
            patch.object(crawler, "read_scholar_id", return_value="test-id"),
            patch.object(crawler, "FETCH_ORDER", ("scholarly",)),
            patch.object(crawler, "fetch_scholarly_stats", side_effect=AttributeError("typing.Union")),
            patch.object(crawler, "fetch_text", side_effect=RuntimeError("offline")),
        ):
            with self.assertRaisesRegex(RuntimeError, "previous stats fallback also failed"):
                crawler.main()
            self.assertFalse((Path(directory) / "gs_data.json").exists())

    def test_interrupt_is_not_swallowed(self):
        with (
            patch.object(crawler, "FETCH_ORDER", ("scholarly",)),
            patch.object(crawler, "fetch_scholarly_stats", side_effect=KeyboardInterrupt),
        ):
            with self.assertRaises(KeyboardInterrupt):
                crawler.fetch_fresh_stats("test-id", "now")


if __name__ == "__main__":
    unittest.main()
