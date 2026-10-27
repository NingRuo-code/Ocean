"""One-shot, bounded operator probe. No disk history, redirects, credentials or model calls."""

import argparse
import http.client
import ipaddress
import json
import re
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit

STATES = {
    "responding",
    "registered",
    "empty_registry",
    "readable_example",
    "not_connected",
    "not_probed",
    "disabled_by_profile",
    "rules_only",
    "read_failed",
}


def origin(value, direct=False):
    url = urlsplit(value)
    if (
        url.scheme not in {"http", "https"}
        or not url.hostname
        or url.username
        or url.password
        or url.path not in {"", "/"}
        or url.query
        or url.fragment
    ):
        raise ValueError("invalid_origin")
    if (
        direct
        and url.hostname != "localhost"
        and not ipaddress.ip_address(url.hostname).is_loopback
    ):
        raise ValueError("direct_requires_loopback")
    _ = url.port
    return value.rstrip("/")


def read_endpoint(base, endpoint):
    url = urlsplit(base)
    connection_type = (
        http.client.HTTPSConnection
        if url.scheme == "https"
        else http.client.HTTPConnection
    )
    connection = connection_type(url.hostname, url.port, timeout=2)
    try:
        connection.request(
            "GET", "/api/" + endpoint, headers={"Cache-Control": "no-store"}
        )
        response = connection.getresponse()
        if response.status != 200:
            return {"state": "http_error", "http_status": response.status}
        raw = response.read(65537)
        if len(raw) > 65536:
            return {"state": "response_budget"}
        value = json.loads(raw)
        if endpoint == "health":
            return {
                "state": "responding"
                if value.get("status") == "ok"
                else "invalid_health"
            }
        if (
            value.get("schema") != "ocean-operational-status/v1"
            or value.get("policy_version") != "ocean-light-status/1"
        ):
            raise ValueError("invalid_status")
        sampled = datetime.fromisoformat(value["sampled_at"])
        if sampled.tzinfo is None:
            raise ValueError("unknown_timezone")
        age = (datetime.now(UTC) - sampled).total_seconds()
        age_field = value["sample_age_seconds"]
        if not isinstance(age_field, (int, float)) or not 0 <= age_field < 1e9:
            raise ValueError("invalid_age")
        states = {
            name: value["layers"][name]["state"]
            for name in (
                "process",
                "map_index",
                "published_read",
                "analysis_execution",
                "fishing_effort",
                "p0_qualification",
                "models",
                "proxy",
                "tasks",
                "backups",
            )
        }
        if not all(state in STATES for state in states.values()):
            raise ValueError("invalid_layer")
        release = value.get("release")
        if release:
            if (
                not re.fullmatch(r"sha256:[a-f0-9]{64}", release["release_id"])
                or not re.fullmatch(r"[a-f0-9]{40}", release["source_commit"])
                or release["profile"] != "isolated-read-only/v1"
            ):
                raise ValueError("invalid_release")
            release = {
                key: release[key] for key in ("release_id", "source_commit", "profile")
            }
        return {
            "state": "stale" if max(age, age_field) > 90 or age < -5 else "sampled",
            "sampled_at": sampled.isoformat(),
            "policy_version": "ocean-light-status/1",
            "release": release,
            "layers": states,
        }
    except (OSError, http.client.HTTPException):
        return {"state": "not_responding"}
    except (ValueError, KeyError, TypeError, AttributeError, RecursionError):
        return {"state": "invalid_response"}
    finally:
        connection.close()


def sample(base):
    # The parent deadline bounds even slow/trickled headers and DNS, not only socket inactivity.
    child = subprocess.Popen(
        [sys.executable, "-I", "-B", str(Path(__file__).resolve()), "--worker"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    try:
        output, _ = child.communicate(base.encode("utf-8"), timeout=6)
        if child.returncode != 0 or len(output) > 16384:
            return {
                "health": {"state": "probe_failed"},
                "status": {"state": "probe_failed"},
            }
        return json.loads(output)
    except subprocess.TimeoutExpired:
        child.kill()
        child.communicate()
        return {
            "health": {"state": "deadline_exceeded"},
            "status": {"state": "deadline_exceeded"},
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--direct", help="Explicit loopback HTTP(S) origin")
    parser.add_argument("--entry", help="Explicit proxy/entry HTTP(S) origin")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.worker:
        base = origin(sys.stdin.buffer.read(2049).decode("utf-8"))
        print(
            json.dumps({key: read_endpoint(base, key) for key in ("health", "status")})
        )
        return
    paths = {}
    try:
        for role, value in (("direct", args.direct), ("entry", args.entry)):
            paths[role] = origin(value, direct=role == "direct") if value else None
    except (ValueError, TypeError):
        parser.error(
            "Use an explicit HTTP(S) origin without credentials, paths or queries; direct must be loopback"
        )
    if not any(paths.values()):
        parser.error(
            "Provide --direct and/or --entry; no server is selected by default"
        )
    report = {
        "schema": "ocean-entry-probe/v1",
        "sampled_at": datetime.now(UTC).isoformat(),
        "policy_version": "ocean-light-status/1",
        "deadline_per_path_seconds": 6,
        "paths": {
            role: sample(value) if value else {"state": "not_connected"}
            for role, value in paths.items()
        },
    }
    report["paths"]["browser"] = {"state": "not_connected"}
    print(json.dumps(report, ensure_ascii=True))


if __name__ == "__main__":
    main()
