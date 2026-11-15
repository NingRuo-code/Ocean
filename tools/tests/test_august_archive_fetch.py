"""Exercise the fixed-archive CLI with an independent, small ZIP over HTTP ranges."""

import hashlib
import importlib
import io
import json
import zipfile
import zlib
from http.client import BadStatusLine
from pathlib import Path

import pytest

TOOLS = Path(__file__).resolve().parents[1]


@pytest.fixture
def archive_case(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(TOOLS))
    fetch = importlib.import_module("fetch_august_archive_members")
    verify = importlib.import_module("verify_august_archive_members")
    payload = b"August archive test observation\n" * 20
    name = "front_location/front_location20240805.nc"
    zipped = io.BytesIO()
    with zipfile.ZipFile(zipped, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("unselected.nc", b"other day")
        archive.writestr(name, payload)
    with zipfile.ZipFile(zipped) as archive:
        member = archive.getinfo(name)
        directory_start = archive.start_dir
    raw_zip = zipped.getvalue()
    catalog = json.loads(verify.CATALOG.read_text(encoding="utf-8"))
    front = catalog["sources"]["front"]
    front.update(archive_bytes=len(raw_zip), central_directory_offset=directory_start)
    front["members"][4].update(
        header_offset=member.header_offset,
        raw_bytes=member.file_size,
        compressed_bytes=member.compress_size,
        crc32=f"{member.CRC:08x}",
    )
    manifest = tmp_path / "fixture-catalog.json"
    manifest.write_text(json.dumps(catalog), encoding="utf-8")
    monkeypatch.setattr(verify, "CATALOG", manifest)
    target = tmp_path / "front/2024/front_location20240805.nc"
    header_end = member.header_offset + 30 + len(name)
    ranges = [(member.header_offset, header_end - 1), (header_end, directory_start - 1)]
    return fetch, payload, raw_zip, target, ranges


def install_transport(monkeypatch, case, failure=None):
    fetch, _, raw_zip, _, expected = case
    requests = []

    def open_range(request, *, timeout):
        assert request.full_url == (
            "https://zenodo.org/records/20356239/files/front_location.zip?download=1"
        )
        assert request.get_header("Accept-encoding") == "identity"
        bounds = request.get_header("Range").removeprefix("bytes=").split("-")
        start, end = map(int, bounds)
        assert (start, end) == expected[len(requests)]
        requests.append((start, end))
        if failure == "protocol":
            raise BadStatusLine("untrusted response marker")
        body = raw_zip[start : end + 1]
        if failure == "crc" and start == expected[1][0]:
            wrong_payload = case[1].replace(b"August", b"Tugust")
            encoder = zlib.compressobj(wbits=-zlib.MAX_WBITS)
            wrong_body = encoder.compress(wrong_payload) + encoder.flush()
            assert len(wrong_body) == len(body)
            body = wrong_body
        response = io.BytesIO(body)
        response.status = 200 if failure == "range" else 206
        response.headers = {"Content-Range": f"bytes {start}-{end}/{len(raw_zip)}"}
        return response

    monkeypatch.setattr(fetch, "urlopen", open_range)
    return requests


def test_explicit_fetch_requests_one_member_and_reuses_verified_local_copy(
    tmp_path, monkeypatch, capsys, archive_case
):
    fetch, payload, _, target, expected = archive_case
    requested = install_transport(monkeypatch, archive_case)
    argv = ["front", "5", "--raw-root", str(tmp_path)]
    assert fetch.main(argv) == 0
    assert not target.exists() and not requested
    assert json.loads(capsys.readouterr().out)["members"][0]["status"] == "missing"
    assert fetch.main([*argv, "--fetch"]) == 0
    assert target.read_bytes() == payload and requested == expected
    row = json.loads(capsys.readouterr().out)["members"][0]
    assert row["status"] == "downloaded" and row["sha256"] == hashlib.sha256(payload).hexdigest()
    assert fetch.main([*argv, "--fetch"]) == 0
    assert requested == expected
    assert json.loads(capsys.readouterr().out)["members"][0]["status"] == "matched"


@pytest.mark.parametrize(
    ("failure", "reason"),
    [
        ("range", "range_mismatch"),
        ("crc", "member_integrity_mismatch"),
        ("protocol", "invalid_http_response"),
    ],
)
def test_bad_http_range_or_invalid_payload_never_publishes_an_original(
    failure, reason, tmp_path, monkeypatch, capsys, archive_case
):
    fetch, _, _, target, _ = archive_case
    install_transport(monkeypatch, archive_case, failure=failure)
    assert fetch.main(["front", "5", "--raw-root", str(tmp_path), "--fetch"]) == 2
    assert not target.exists()
    assert not list(tmp_path.rglob("*.part"))
    captured = capsys.readouterr()
    assert json.loads(captured.out)["members"][0]["reason"] == reason
    assert "untrusted response marker" not in captured.out + captured.err
    assert str(tmp_path) not in captured.out + captured.err
