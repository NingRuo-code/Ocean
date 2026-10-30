"""Frozen-version chart API contract, observed through the actual owner routes."""

import xml.etree.ElementTree as ET
import json

import pytest

from test_synthetic_cases import AUTH, BASE, case_client, save_request

from app.analysis_support import content_id


def test_chart_uses_frozen_days_and_identity_after_original_source_disappears(tmp_path):
    client, published = case_client(tmp_path)
    first = client.post(BASE + "/cases", headers=AUTH, json=save_request(client)).json()
    published.unlink()
    url = BASE + f"/cases/{first['case_id']}/versions/1/exports/chart"
    params = {"version_id": first["version_id"], "report_id": first["report"]["report_id"]}
    response = client.get(url, headers=AUTH, params=params)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert response.headers["cache-control"] == "no-store"
    root = ET.fromstring(response.content)
    assert root.attrib["width"] == "1600"
    assert root.attrib["data-case-version-id"] == first["version_id"]
    assert root.attrib["data-report-id"] == first["report"]["report_id"]
    states = root.findall(".//*[@data-state]")
    assert [s.attrib["data-state"] for s in states].count("positive") == 1
    assert [s.attrib["data-state"] for s in states].count("zero") == 1
    assert [s.attrib["data-state"] for s in states].count("unknown") == 27
    assert states[0].attrib["data-hours"] == "40.0"
    assert "data-hours" not in states[2].attrib
    assert "40 h" in response.text and "7 km²·d" in response.text and "2/29" in response.text
    assert "真实研究资格未通过" in response.text
    assert first["metadata"]["note"] not in response.text
    assert response.content == client.get(url, headers=AUTH, params=params).content
    assert client.get(url, params=params).status_code == 401
    assert client.get(url, headers=AUTH, params={**params, "version_id": "sha256:" + "0" * 64}).status_code == 409


@pytest.mark.parametrize("supported", [False, True])
def test_unknown_and_known_zero_figures_do_not_invent_positive_scales(tmp_path, supported):
    client, published = case_client(tmp_path)
    if not supported:
        pack = json.loads(published.read_text(encoding="utf-8"))
        entry = pack["snapshots"][0]
        raw = entry["result"]
        raw["status"] = "unavailable"
        raw["metrics"].update(total_hours=None, supported_days=0, area_time_km2_days=None, mean_hours_per_supported_day=None, density_hours_per_km2_day=None)
        for day in raw["daily"]:
            day.update(state="unprepared", hours=None, effective_area_km2=None, area_time_km2_days=None, excluded_units=0)
        raw["coverage"].update(status="unavailable", excluded_day_states={"unprepared": 29}, excluded_units=0)
        raw["parameters"]["input_version"] = raw["source"]["version"] = "synthetic-all-unknown/v1"
        raw["source"].update(id="authored-all-unknown-month", input_sha256=content_id(raw["daily"]), support_evidence="Self-authored all-unknown software figure test; no observations")
        raw["result_id"] = content_id({"authored_fixture": "all-unknown/v1", "parameters": raw["parameters"], "daily": raw["daily"]})
        entry["snapshot_sha256"] = content_id(raw)
        published.write_text(json.dumps(pack, ensure_ascii=False), encoding="utf-8")
    items = client.get(BASE + "/published").json()["results"]
    item = items[1 if supported else 0]
    report = client.get(BASE + "/published/" + item["result_id"] + "/report", params={"projection_id": item["projection_id"]}).json()
    request = {**save_request(client), "result_id": item["result_id"], "projection_id": item["projection_id"], "report_id": report["report_id"]}
    first = client.post(BASE + "/cases", headers=AUTH, json=request).json()
    response = client.get(BASE + f"/cases/{first['case_id']}/versions/1/exports/chart", headers=AUTH, params={"version_id": first["version_id"], "report_id": report["report_id"]})
    root = ET.fromstring(response.content)
    assert root.attrib["data-axis"] == ("hours" if supported else "unknown-only")
    states = [n.attrib["data-state"] for n in root.findall(".//*[@data-state]")]
    assert "positive" not in states
    assert states.count("zero") == (1 if supported else 0)
    assert ("全部日期支持未知" in response.text) != supported


def test_long_sources_and_every_caveat_are_wrapped_as_inert_text_without_clipping(tmp_path):
    client, published = case_client(tmp_path)
    pack = json.loads(published.read_text(encoding="utf-8"))
    entry = pack["snapshots"][0]
    entry["result"]["source"]["id"] = "来源" * 250
    entry["result"]["caveats"] = [str(n) + "原局限<script>&不可丢弃" * 24 for n in range(16)]
    entry["snapshot_sha256"] = content_id(entry["result"])
    published.write_text(json.dumps(pack, ensure_ascii=False), encoding="utf-8")
    first = client.post(BASE + "/cases", headers=AUTH, json=save_request(client)).json()
    response = client.get(BASE + f"/cases/{first['case_id']}/versions/1/exports/chart", headers=AUTH, params={"version_id": first["version_id"], "report_id": first["report"]["report_id"]})
    assert response.status_code == 200
    root = ET.fromstring(response.content)
    height = int(root.attrib["height"])
    assert 2000 < height <= 10000
    text_nodes = root.findall(".//{http://www.w3.org/2000/svg}text")
    all_text = "".join(t.text or "" for t in text_nodes)
    assert "来源" * 250 in all_text
    for caveat in entry["result"]["caveats"]:
        assert caveat in all_text
    assert not root.findall(".//{http://www.w3.org/2000/svg}script")
    assert all(float(t.attrib["y"]) < height - 20 for t in text_nodes)
