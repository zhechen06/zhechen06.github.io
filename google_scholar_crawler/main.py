from __future__ import annotations

import json
import os
import random
import re
import signal
import time
import tomllib
from contextlib import contextmanager
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "content" / "config.toml"
OUTPUT_DIR = ROOT / "google-scholar-stats"
DEFAULT_REPOSITORY = "zhechen06/zhechen06.github.io"
FETCH_ATTEMPTS = int(os.environ.get("SCHOLAR_FETCH_ATTEMPTS", "3"))
FETCH_TIMEOUT_SECONDS = float(os.environ.get("SCHOLAR_FETCH_TIMEOUT_SECONDS", "12"))
FREE_PROXY_TIMEOUT_SECONDS = float(os.environ.get("SCHOLAR_FREE_PROXY_TIMEOUT_SECONDS", "35"))
SCHOLARLY_ATTEMPT_TIMEOUT_SECONDS = float(os.environ.get("SCHOLARLY_ATTEMPT_TIMEOUT_SECONDS", "45"))
FETCH_ORDER = tuple(
    method.strip().lower()
    for method in os.environ.get("SCHOLAR_FETCH_ORDER", "scholarly,direct").split(",")
    if method.strip()
)

METRIC_LABELS = {
    "citations": "citedby",
    "h-index": "hindex",
    "i10-index": "i10index",
}

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


class ScholarStatsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.cells: list[tuple[str, str]] = []
        self._capture: str | None = None
        self._buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in {"td", "th"}:
            return

        classes = set((dict(attrs).get("class") or "").split())
        if "gsc_rsb_sc1" in classes:
            self._capture = "label"
            self._buffer = []
        elif "gsc_rsb_std" in classes:
            self._capture = "value"
            self._buffer = []

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag not in {"td", "th"} or not self._capture:
            return

        text = " ".join("".join(self._buffer).split())
        if text:
            self.cells.append((self._capture, text))
        self._capture = None
        self._buffer = []


def read_scholar_id() -> str:
    env_id = os.environ.get("GOOGLE_SCHOLAR_ID")
    if env_id:
        return env_id

    config = tomllib.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    scholar_url = config.get("social", {}).get("google_scholar", "")
    query = parse_qs(urlparse(scholar_url).query)
    scholar_id = query.get("user", [""])[0]
    if not scholar_id:
        raise RuntimeError(f"Unable to find google_scholar user id in {CONFIG_PATH}")
    return scholar_id


def scholar_profile_url(scholar_id: str) -> str:
    return "https://scholar.google.com/citations?" + urlencode(
        {
            "user": scholar_id,
            "hl": "en",
        }
    )


def previous_stats_url() -> str:
    env_url = os.environ.get("GOOGLE_SCHOLAR_STATS_FALLBACK_URL")
    if env_url:
        return env_url

    repository = os.environ.get("GITHUB_REPOSITORY", DEFAULT_REPOSITORY)
    return f"https://cdn.jsdelivr.net/gh/{repository}@google-scholar-stats/gs_data.json"


def fetch_text(url: str, *, attempts: int = FETCH_ATTEMPTS, timeout: float = FETCH_TIMEOUT_SECONDS) -> str:
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        request = Request(url, headers=REQUEST_HEADERS)
        try:
            with urlopen(request, timeout=timeout) as response:
                status = getattr(response, "status", 200)
                if status >= 400:
                    raise RuntimeError(f"HTTP {status}")
                encoding = response.headers.get_content_charset() or "utf-8"
                return response.read().decode(encoding, errors="replace")
        except (HTTPError, URLError, TimeoutError, OSError, RuntimeError) as error:
            last_error = error
            if attempt < attempts:
                time.sleep(min(2 ** (attempt - 1), 4))

    raise RuntimeError(f"Unable to fetch {url}: {last_error}") from last_error


def parse_integer(value: object, label: str) -> int:
    if isinstance(value, bool):
        raise RuntimeError(f"Google Scholar metric is not an integer: {label}")
    if isinstance(value, int):
        return value

    match = re.search(r"\d[\d,]*", str(value))
    if not match:
        raise RuntimeError(f"Google Scholar metric is missing: {label}")
    return int(match.group(0).replace(",", ""))


def metric_value(stats: dict, key: str) -> int:
    if key not in stats:
        raise RuntimeError(f"Google Scholar result is missing field: {key}")
    return parse_integer(stats[key], key)


@contextmanager
def timeout_after(seconds: float, label: str):
    if seconds <= 0 or not hasattr(signal, "SIGALRM"):
        yield
        return

    def handle_timeout(_signum, _frame) -> None:
        raise TimeoutError(f"{label} timed out after {seconds:g} seconds")

    previous_handler = signal.getsignal(signal.SIGALRM)
    signal.signal(signal.SIGALRM, handle_timeout)
    previous_timer = signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.signal(signal.SIGALRM, previous_handler)
        signal.setitimer(signal.ITIMER_REAL, *previous_timer)


def parse_profile_metrics(profile_html: str) -> dict[str, int]:
    lower_html = profile_html.lower()
    if "detected unusual traffic" in lower_html or "/sorry/" in lower_html:
        raise RuntimeError("Google Scholar returned an anti-bot page")

    parser = ScholarStatsParser()
    parser.feed(profile_html)

    metrics: dict[str, int] = {}
    for index, (cell_type, text) in enumerate(parser.cells):
        if cell_type != "label":
            continue

        key = METRIC_LABELS.get(text.strip().lower())
        if not key:
            continue

        for next_type, next_text in parser.cells[index + 1 :]:
            if next_type == "label":
                break
            if next_type == "value":
                metrics[key] = parse_integer(next_text, text)
                break

    missing = [key for key in METRIC_LABELS.values() if key not in metrics]
    if missing:
        raise RuntimeError(f"Unable to parse Google Scholar metrics: {', '.join(missing)}")

    return metrics


def import_scholarly_client():
    try:
        from scholarly import ProxyGenerator, scholarly
    except ImportError as error:
        raise RuntimeError("The scholarly package is required for scholarly fetch mode") from error

    return scholarly, ProxyGenerator


def configure_scholarly_proxy(*, use_free_proxy: bool):
    scholarly, proxy_generator_class = import_scholarly_client()

    if not use_free_proxy:
        return scholarly, "scholarly_runner_ip"

    proxy_generator = proxy_generator_class()
    try:
        with timeout_after(FREE_PROXY_TIMEOUT_SECONDS, "scholarly free proxy setup"):
            if proxy_generator.FreeProxies():
                scholarly.use_proxy(proxy_generator, proxy_generator)
                return scholarly, "scholarly_free_proxy"
    except Exception as error:
        raise RuntimeError(f"Unable to configure scholarly free proxy: {error}") from error

    raise RuntimeError("Unable to find a working scholarly free proxy")


def fetch_scholarly_stats(scholar_id: str, updated_at: str, *, use_free_proxy: bool) -> dict:
    scholarly, fetch_source = configure_scholarly_proxy(use_free_proxy=use_free_proxy)
    last_error: Exception | None = None

    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            with timeout_after(SCHOLARLY_ATTEMPT_TIMEOUT_SECONDS, f"{fetch_source} attempt {attempt}"):
                author = scholarly.search_author_id(scholar_id)
                try:
                    author = scholarly.fill(author, sections=["basics", "indices"])
                except Exception as fill_error:
                    if not all(key in author for key in METRIC_LABELS.values()):
                        raise RuntimeError(f"Unable to fill scholarly author indices: {fill_error}") from fill_error

                metrics = {
                    "citedby": metric_value(author, "citedby"),
                    "hindex": metric_value(author, "hindex"),
                    "i10index": metric_value(author, "i10index"),
                }
            return compact_metric_data(
                metrics,
                scholar_id,
                updated_at,
                fetch_status="fresh",
                fetch_source=fetch_source,
            )
        except Exception as error:
            last_error = error
            if attempt < FETCH_ATTEMPTS:
                time.sleep(random.uniform(2, 10))

    raise RuntimeError(f"Unable to fetch Google Scholar metrics with {fetch_source}: {last_error}") from last_error


def compact_metric_data(
    metrics: dict[str, int],
    scholar_id: str,
    updated_at: str,
    *,
    fetch_status: str,
    fetch_source: str,
    fetch_error: str | None = None,
) -> dict:
    data = {
        "container_type": "Author",
        "filled": ["metrics"],
        "scholar_id": scholar_id,
        "source": scholar_profile_url(scholar_id),
        "citedby": metric_value(metrics, "citedby"),
        "hindex": metric_value(metrics, "hindex"),
        "i10index": metric_value(metrics, "i10index"),
        "updated": updated_at,
        "fetch_status": fetch_status,
        "fetch_source": fetch_source,
    }
    if fetch_error:
        data["fetch_error"] = fetch_error
    return data


def fetch_direct_profile_stats(scholar_id: str, updated_at: str) -> dict:
    profile_url = scholar_profile_url(scholar_id)
    profile_html = fetch_text(profile_url)
    metrics = parse_profile_metrics(profile_html)
    return compact_metric_data(
        metrics,
        scholar_id,
        updated_at,
        fetch_status="fresh",
        fetch_source="google_scholar_profile",
    )


def fetch_fresh_stats(scholar_id: str, updated_at: str) -> dict:
    errors: list[str] = []
    handlers = {
        "scholarly": lambda: fetch_scholarly_stats(scholar_id, updated_at, use_free_proxy=False),
        "scholarly_free_proxy": lambda: fetch_scholarly_stats(scholar_id, updated_at, use_free_proxy=True),
        "direct": lambda: fetch_direct_profile_stats(scholar_id, updated_at),
    }

    for method in FETCH_ORDER:
        handler = handlers.get(method)
        if not handler:
            errors.append(f"{method}: unknown fetch mode")
            continue

        try:
            return handler()
        except RuntimeError as error:
            print(f"{method} fetch failed: {error}")
            errors.append(f"{method}: {error}")

    raise RuntimeError("; ".join(errors) or "No Google Scholar fetch methods configured")


def read_previous_stats(scholar_id: str, updated_at: str, fetch_error: str) -> dict:
    candidates: list[tuple[str, str]] = []
    local_stats = OUTPUT_DIR / "gs_data.json"
    if local_stats.exists():
        candidates.append(("local_previous_stats", local_stats.read_text(encoding="utf-8")))

    try:
        candidates.append(("remote_previous_stats", fetch_text(previous_stats_url(), attempts=2, timeout=8)))
    except RuntimeError as error:
        if not candidates:
            raise RuntimeError(f"{fetch_error}; previous stats fallback also failed: {error}") from error

    for source, raw_stats in candidates:
        try:
            previous = json.loads(raw_stats)
            metrics = {
                "citedby": metric_value(previous, "citedby"),
                "hindex": metric_value(previous, "hindex"),
                "i10index": metric_value(previous, "i10index"),
            }
            return compact_metric_data(
                metrics,
                scholar_id,
                previous.get("updated") or updated_at,
                fetch_status="stale",
                fetch_source=source,
                fetch_error=fetch_error,
            )
        except (json.JSONDecodeError, RuntimeError):
            continue

    raise RuntimeError(f"{fetch_error}; no usable previous Google Scholar stats found")


def shield_payload(label: str, message: int | str) -> dict:
    return {
        "schemaVersion": 1,
        "label": label,
        "message": f"{message:,}" if isinstance(message, int) else str(message),
        "color": "9cf",
        "namedLogo": "Google Scholar",
    }


def write_json(path: Path, payload: dict) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    scholar_id = read_scholar_id()
    updated_at = datetime.now(timezone.utc).isoformat()

    try:
        stats = fetch_fresh_stats(scholar_id, updated_at)
    except RuntimeError as error:
        print(f"Fresh Google Scholar fetch failed: {error}")
        stats = read_previous_stats(scholar_id, updated_at, str(error))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_json(OUTPUT_DIR / "gs_data.json", stats)
    write_json(OUTPUT_DIR / "gs_data_shieldsio.json", shield_payload("citations", stats["citedby"]))
    write_json(OUTPUT_DIR / "gs_hindex_shieldsio.json", shield_payload("h-index", stats["hindex"]))

    print(
        "Updated Google Scholar stats: "
        f"citations={stats['citedby']:,}, h-index={stats['hindex']}, "
        f"status={stats['fetch_status']}"
    )


if __name__ == "__main__":
    main()
