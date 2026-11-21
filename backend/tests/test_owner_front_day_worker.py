"""Private single-day front processing with the optional checked local member."""

from datetime import date
from pathlib import Path

import pytest
from tools.prepare_owner_front_day import prepare_front_day
from tools.verify_august_archive_members import check_member, load_catalog, member_path

from app.analysis_support import content_id

DAY = date(2024, 8, 5)
BBOX = (120.0, 27.0, 128.0, 34.0)
ARCHIVE = Path(__file__).resolve().parents[2] / "data/raw"


@pytest.fixture
def registered_member():
    expected = load_catalog()["sources"]["front"]["members"][DAY.day - 1]
    relative = member_path("front", DAY.day)
    status, digest = check_member(ARCHIVE, relative, expected["raw_bytes"], expected["crc32"])
    if status != "matched":
        pytest.skip("Checked original front member is not installed")
    return relative, digest


def test_original_front_member_prepares_private_map_only(registered_member):
    _, digest = registered_member
    result = prepare_front_day(ARCHIVE, DAY, BBOX, digest)
    identity = result.pop("artifact_id")
    assert identity == content_id(result)
    assert result["date"] == DAY.isoformat()
    assert result["bbox"] == list(BBOX)
    assert result["scope"] == "private_map_display"
    assert result["license"] == "CC BY 4.0"
    assert result["date_basis"] == "archive_member_name"
    assert result["cell_bounds_verified"] is False
    assert result["research_ready"] is False
    assert result["support"] == {"valid": 19102, "missing": 3298, "front": 411, "resolution_deg": 0.05}


def test_replaced_same_size_local_member_fails_before_processing(registered_member, tmp_path):
    relative, digest = registered_member
    replacement = tmp_path / relative
    replacement.parent.mkdir(parents=True)
    data = bytearray((ARCHIVE / relative).read_bytes())
    data[-1] ^= 1
    replacement.write_bytes(data)
    with pytest.raises(ValueError, match="no longer matches"):
        prepare_front_day(tmp_path, DAY, BBOX, digest)


def test_refuses_a_nonregistered_day_or_overbudget_window(tmp_path):
    with pytest.raises(ValueError, match="outside the registered archive"):
        prepare_front_day(tmp_path, date(2024, 9, 5), BBOX, "0" * 64)
    with pytest.raises(ValueError, match="small preparation budget"):
        prepare_front_day(tmp_path, DAY, (100, 10, 150, 50), "0" * 64)
