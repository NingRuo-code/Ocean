import json

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


def setup_exports(tmp_path, monkeypatch):
    root = tmp_path / "prototype"
    for folder in ("day", "sst", "front_response"):
        (root / folder).mkdir(parents=True)
    grid = {"lon0": 120.025, "lat0": 30.025, "dlon": 0.05, "dlat": 0.05, "nx": 2, "ny": 2}
    day = {
        "date": "2024-08-05",
        "grid": grid,
        "source_file": "authored-front.json",
        "objects": [
            {
                "front_id": "T1",
                "line": [[120.025, 30.025], [120.075, 30.075]],
                "bbox": [120.025, 30.025, 120.075, 30.075],
                "centroid": [120.05, 30.05],
                "pixel_count": 2,
                "length_km": 6,
                "codes": [10],
            }
        ],
    }
    sst = {
        "date": "2024-08-05",
        "grid": dict(grid),
        "bin_c": 0.5,
        "product": {"unit": "degree_C", "bin_c": 0.5, "license": "CC0-1.0"},
        "runs": [[0, 0, 2, 40], [1, 0, 2, 0]],
        "source_file": "authored-sst.json",
    }
    response = {
        "source": {"kind": "authored_aggregate", "license": "CC0-1.0"},
        "time_window": {"post": [1, 3]},
        "by_date": {
            "2024-08-05": {
                "by_range": {
                    "20": {
                        "front_id": "T1",
                        "date": "2024-08-05",
                        "coverage_status": "available",
                        "status": "available",
                        "buffer_km": 20,
                        "post1_3_hours": 0,
                        "pre7_hours": 2,
                        "non_front_control_hours": 0,
                    },
                }
            }
        },
    }
    write_exports(root, day, sst, response)
    monkeypatch.setattr(settings, "prototype_data_dir", root)
    monkeypatch.setattr(settings, "cache_dir", tmp_path / "cache")
    return TestClient(app, raise_server_exceptions=False), root, day, sst, response


def write_exports(root, day, sst, response):
    for name, marker, value in (
        ("day/2024-08-05.js", 'window.OF_DATA_DAYS["2024-08-05"]', day),
        ("sst/2024-08-05.js", 'window.OF_DATA_SST["2024-08-05"]', sst),
        ("front_response/events.js", "window.OF_FRONT_RESPONSE", response),
    ):
        (root / name).write_text(marker + " = " + json.dumps(value) + ";", encoding="utf-8")


def query(client):
    return client.get(
        "/api/viewport",
        params={
            "date": "2024-08-05",
            "bbox": "120,30,120.1,30.1",
            "step": 1,
        },
    )


def test_invalid_sst_grid_degrades_only_that_layer_in_original_api(tmp_path, monkeypatch):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    sst["grid"]["nx"] = "broken"
    write_exports(root, day, sst, response)
    result = query(client)
    assert result.status_code == 200
    value = result.json()
    assert value["coverage"]["layers"]["sst"] == "unavailable"
    assert value["layers"]["sst"]["cells"] == []
    assert value["layers"]["fronts"]["features"][0]["properties"]["frontId"] == "T1"
    assert value["layers"]["fishingEffort"]["cells"][0]["hours"] == 0
    assert value["meta"]["status"] == "partial"


def test_unknown_response_hours_are_not_turned_into_zero_and_celsius_zero_is_valid(
    tmp_path, monkeypatch
):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    response["by_date"]["2024-08-05"]["by_range"]["20"]["post1_3_hours"] = None
    write_exports(root, day, sst, response)
    result = query(client)
    assert result.status_code == 200
    value = result.json()
    assert value["coverage"]["layers"]["fishingEffort"] == "unavailable"
    assert value["layers"]["fishingEffort"]["cells"] == []
    assert [cell["value"] for cell in value["layers"]["sst"]["cells"]] == [20.0, 20.0, 0.0, 0.0]
    assert value["layers"]["sst"]["sourceUnit"] == "degree_C"


def test_invalid_front_geometry_is_not_a_server_error_or_no_front_observation(
    tmp_path, monkeypatch
):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    day["objects"][0]["line"][0][0] = "PRIVATE_BAD_COORDINATE"
    write_exports(root, day, sst, response)
    result = query(client)
    assert result.status_code == 200
    value = result.json()
    assert value["coverage"]["layers"]["fronts"] == "unavailable"
    assert value["layers"]["fronts"]["features"] == []
    assert value["layers"]["sst"]["cells"][0]["value"] == 20
    assert value["layers"]["fishingEffort"]["cells"] == []
    assert "PRIVATE" not in result.text


def test_malformed_response_structure_does_not_drop_front_or_temperature(tmp_path, monkeypatch):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    response["by_date"] = []
    response["events"] = None
    write_exports(root, day, sst, response)
    result = query(client)
    assert result.status_code == 200
    assert result.json()["coverage"]["layers"]["fishingEffort"] == "unavailable"
    assert result.json()["layers"]["fronts"]["features"]


@pytest.mark.parametrize("hours", [0, 27, None, -1, float("nan"), "0", False])
def test_response_hours_keep_explicit_zero_and_multi_vessel_hours_but_reject_unknown(
    tmp_path, monkeypatch, hours
):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    row = response["by_date"]["2024-08-05"]["by_range"]["20"]
    row["post1_3_hours"] = hours
    row.pop("pre7_hours")
    row.pop("non_front_control_hours")
    write_exports(root, day, sst, response)
    result = query(client)
    assert result.status_code == 200
    cells = result.json()["layers"]["fishingEffort"]["cells"]
    if type(hours) in (int, float) and hours in (0, 27):
        assert cells[0]["hours"] == hours
        assert cells[0]["pre7Hours"] is None and cells[0]["controlHours"] is None
    else:
        assert cells == []
        assert result.json()["coverage"]["layers"]["fishingEffort"] == "unavailable"


def test_duplicate_front_ids_are_not_silently_overwritten(tmp_path, monkeypatch):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    day["objects"].append(dict(day["objects"][0]))
    write_exports(root, day, sst, response)
    value = query(client).json()
    assert value["coverage"]["layers"]["fronts"] == "unavailable"
    assert value["layers"]["fronts"]["source"]["excludedObjects"] == 2
    assert value["layers"]["fishingEffort"]["cells"] == []


def test_old_contract_cache_cannot_bypass_typed_reading(tmp_path, monkeypatch):
    client, *_ = setup_exports(tmp_path, monkeypatch)
    first = query(client).json()
    assert first["meta"]["cache"]["version"].endswith("contract-v2")
    current = next((tmp_path / "cache/viewport").glob("*/*.json"))
    value = json.loads(current.read_text(encoding="utf-8"))
    value["version"] = value["version"].replace("contract-v2", "contract-v1")
    value["response"]["layers"]["sst"]["cells"][0]["value"] = 999
    old = current.parent.with_name(current.parent.name.replace("contract-v2", "contract-v1"))
    old.mkdir()
    (old / current.name).write_text(json.dumps(value), encoding="utf-8")
    current.unlink()
    second = query(client).json()
    assert second["meta"]["cache"]["hit"] is False
    assert second["layers"]["sst"]["cells"][0]["value"] == 20
    third = query(client).json()
    assert third["meta"]["cache"]["hit"] is True
    assert third["layers"] == second["layers"]


@pytest.mark.parametrize(
    "mode",
    [
        "unit",
        "metric",
        "row_unit",
        "source_unit",
        "row_metric",
        "date",
        "coverage",
        "status",
        "missing_coverage",
    ],
)
def test_explicit_response_conflicts_and_unknown_coverage_do_not_publish_zero(
    tmp_path, monkeypatch, mode
):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    row = response["by_date"]["2024-08-05"]["by_range"]["20"]
    if mode == "unit":
        response["unit"] = "kg"
    elif mode == "metric":
        response["metric"] = "catch"
    elif mode == "row_unit":
        row["unit"] = "kg"
    elif mode == "source_unit":
        response["source"]["unit"] = "kg"
    elif mode == "row_metric":
        row["metric"] = "catch"
    elif mode == "date":
        row["date"] = "2024-08-06"
    elif mode == "coverage":
        row["coverage_status"] = "unavailable"
    elif mode == "status":
        row["status"] = "unavailable"
    else:
        row.pop("coverage_status")
    write_exports(root, day, sst, response)
    result = query(client)
    assert result.status_code == 200
    assert result.json()["coverage"]["layers"]["fishingEffort"] == "unavailable"
    assert result.json()["layers"]["fishingEffort"]["cells"] == []


@pytest.mark.parametrize("kind", ["front", "response"])
def test_good_and_bad_records_sharing_an_identity_are_both_ambiguous(tmp_path, monkeypatch, kind):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    if kind == "front":
        other = dict(day["objects"][0])
        other["line"] = [[None, 30.025], [120.075, 30.075]]
        day["objects"].append(other)
    else:
        rows = response["by_date"]["2024-08-05"]["by_range"]
        rows["copy"] = {**rows["20"], "post1_3_hours": None}
    write_exports(root, day, sst, response)
    value = query(client).json()
    name = "fronts" if kind == "front" else "fishingEffort"
    assert value["coverage"]["layers"][name] == "unavailable"


def test_finite_bin_inputs_cannot_overflow_the_decoded_temperature(tmp_path, monkeypatch):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    sst["bin_c"] = sst["product"]["bin_c"] = 1e308
    write_exports(root, day, sst, response)
    result = query(client)
    assert result.status_code == 200
    assert result.json()["coverage"]["layers"]["sst"] == "unavailable"
    assert result.json()["layers"]["fronts"]["features"]


def test_equivalent_second_js_assignment_is_not_ignored(tmp_path, monkeypatch):
    client, root, _day, sst, _response = setup_exports(tmp_path, monkeypatch)
    path = root / "sst/2024-08-05.js"
    path.write_text(
        path.read_text(encoding="utf-8")
        + "\nwindow . OF_DATA_SST [ '2024-08-05' ] = "
        + json.dumps(sst)
        + ";",
        encoding="utf-8",
    )
    result = query(client)
    assert result.status_code == 200
    assert result.json()["coverage"]["layers"]["sst"] == "unavailable"


def test_valid_vertical_front_and_real_zero_response_remain_readable(tmp_path, monkeypatch):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    front = day["objects"][0]
    front["line"] = [[120.05, 30.025], [120.05, 30.075]]
    front["bbox"] = [120.05, 30.025, 120.05, 30.075]
    write_exports(root, day, sst, response)
    result = query(client)
    assert result.status_code == 200
    value = result.json()
    assert len(value["layers"]["fronts"]["features"]) == 1
    assert value["layers"]["fishingEffort"]["cells"][0]["hours"] == 0
    assert value["layers"]["fishingEffort"]["representation"] == "front_response_aggregate_points"
    assert value["layers"]["fishingEffort"]["timeWindow"] == {"post": [1, 3]}
    assert result.json()["layers"]["sst"]["cells"]


def test_duplicate_response_identity_is_not_double_counted_or_silently_chosen(
    tmp_path, monkeypatch
):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    records = response["by_date"]["2024-08-05"]["by_range"]
    records["20-copy"] = dict(records["20"])
    write_exports(root, day, sst, response)
    result = query(client).json()
    assert result["coverage"]["layers"]["fishingEffort"] == "unavailable"
    assert result["layers"]["fishingEffort"]["cells"] == []
    assert result["layers"]["fishingEffort"]["excludedRecords"] == 2


@pytest.mark.parametrize("mode", ["date", "unit", "bin", "overlap", "out_of_range"])
def test_unverified_temperature_encoding_never_becomes_celsius_cells(tmp_path, monkeypatch, mode):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    if mode == "date":
        sst["date"] = "2024-08-06"
    elif mode == "unit":
        sst["product"]["unit"] = "K"
    elif mode == "bin":
        sst.pop("bin_c")
    elif mode == "overlap":
        sst["runs"].append([0, 0, 1, 99])
    else:
        sst["runs"][0] = [0, 0, 3, 40]
    write_exports(root, day, sst, response)
    result = query(client)
    assert result.status_code == 200
    assert result.json()["coverage"]["layers"]["sst"] == "unavailable"
    assert result.json()["layers"]["sst"]["cells"] == []


@pytest.mark.parametrize("mode", ["duplicate_key", "nonfinite_metadata", "second_assignment"])
def test_ambiguous_or_non_json_static_exports_do_not_change_observations(
    tmp_path, monkeypatch, mode
):
    client, root, day, sst, response = setup_exports(tmp_path, monkeypatch)
    path = root / "sst/2024-08-05.js"
    text = path.read_text(encoding="utf-8")
    if mode == "duplicate_key":
        text = text.replace('"bin_c": 0.5', '"bin_c": 0.5, "bin_c": 0.5', 1)
    elif mode == "nonfinite_metadata":
        sst["product"]["unknown"] = float("nan")
        write_exports(root, day, sst, response)
        text = path.read_text(encoding="utf-8")
    else:
        text += text
    path.write_text(text, encoding="utf-8")
    result = query(client)
    assert result.status_code == 200
    assert result.json()["coverage"]["layers"]["sst"] == "unavailable"
    assert result.json()["layers"]["fronts"]["features"]
