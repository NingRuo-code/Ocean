"""Actual owner API to frozen-version downloaded files, not research qualification."""

import csv
import io

import pytest

from test_synthetic_cases import AUTH, BASE, case_client, save_request


def test_downloads_keep_selected_saved_version_notes_and_evidence_without_source(tmp_path):
    client, published = case_client(tmp_path)
    first = client.post(BASE + "/cases", headers=AUTH, json=save_request(client)).json()
    response = client.put(BASE + "/cases/" + first["case_id"], headers=AUTH, json={
        **first["metadata"], "note": "第二版笔记不应混入旧版", "base_version": 1,
        "base_version_id": first["version_id"], "intent_id": "b" * 32,
    })
    assert response.status_code == 200
    published.unlink()
    url = BASE + f"/cases/{first['case_id']}/versions/1/exports/"
    params = {"version_id": first["version_id"], "report_id": first["report"]["report_id"]}
    markdown = client.get(url + "markdown", headers=AUTH, params=params)
    assert markdown.status_code == 200
    assert "人工笔记，不是科学解释" in markdown.text
    assert "第二版笔记" not in markdown.text
    assert first["version_id"][7:] in markdown.text
    assert "40" in markdown.text and "真实研究资格未通过" in markdown.text
    assert markdown.headers["cache-control"] == "no-store"
    assert 'attachment; filename="Ocean-case-' in markdown.headers["content-disposition"]
    table = client.get(url + "csv", headers=AUTH, params=params)
    assert table.status_code == 200 and table.content.startswith(b"\xef\xbb\xbf")
    rows = list(csv.reader(io.StringIO(table.content.decode("utf-8-sig"))))
    assert ["case_version", "1"] in rows
    assert ["human_note", "人工笔记，不是科学解释"] in rows
    assert ["2024-02-02", "partial_support", "0.0", "2.0", "2.0"] in rows
    assert ["2024-02-03", "no_records", "", "", ""] in rows
    assert client.get(BASE + "/cases/" + first["case_id"] + "/versions", headers=AUTH).json()["versions"][0]["version"] == 2


@pytest.mark.parametrize("representation", ["markdown", "csv"])
def test_download_authorization_identity_and_not_found_fail_without_files(tmp_path, representation):
    client, _ = case_client(tmp_path)
    first = client.post(BASE + "/cases", headers=AUTH, json=save_request(client)).json()
    url = BASE + f"/cases/{first['case_id']}/versions/1/exports/{representation}"
    params = {"version_id": first["version_id"], "report_id": first["report"]["report_id"]}
    for auth in [{}, {"Authorization": "Bearer wrong-owner"}]:
        response = client.get(url, headers=auth, params=params)
        assert response.status_code == 401 and response.headers["cache-control"] == "no-store"
        assert first["metadata"]["note"] not in response.text
    for key in params:
        response = client.get(url, headers=AUTH, params={**params, key: "sha256:" + "0" * 64})
        assert response.status_code == 409
        assert "content-disposition" not in response.headers
    assert client.get(url.replace("/versions/1/", "/versions/2/"), headers=AUTH, params=params).status_code == 404
    assert client.get(url.replace(first["case_id"], "0" * 32), headers=AUTH, params=params).status_code == 404
    assert client.get(url, headers=AUTH).status_code == 422
    assert client.get(url.replace("/versions/1/", "/versions/17/"), headers=AUTH, params=params).status_code == 422


def test_export_escapes_human_markup_formulas_and_handles_maximum_utf8_fields(tmp_path):
    client, _ = case_client(tmp_path)
    request = {**save_request(client), "title": "=HYPERLINK(\"https://invalid\")", "tags": ["A,B", "甲，乙"], "note": "<script>alert('x')</script>\n=SUM(1,2)"}
    first = client.post(BASE + "/cases", headers=AUTH, json=request).json()
    url = BASE + f"/cases/{first['case_id']}/versions/1/exports/"
    params = {"version_id": first["version_id"], "report_id": first["report"]["report_id"]}
    markdown = client.get(url + "markdown", headers=AUTH, params=params)
    assert "<script>" not in markdown.text and r"\<script\>" in markdown.text
    table = client.get(url + "csv", headers=AUTH, params=params)
    rows = list(csv.reader(io.StringIO(table.content.decode("utf-8-sig"))))
    assert ["human_title", "'=HYPERLINK(\"https://invalid\")"] in rows
    assert ["human_tags", "A,B\n甲，乙"] in rows
    request.update(title="🚢" * 120, tags=[str(n) + "🚢" * 39 for n in range(8)], note="🚢" * 4000, intent_id="c" * 32)
    large = client.post(BASE + "/cases", headers=AUTH, json=request).json()
    for representation in ["markdown", "csv"]:
        response = client.get(BASE + f"/cases/{large['case_id']}/versions/1/exports/{representation}", headers=AUTH, params={"version_id": large["version_id"], "report_id": large["report"]["report_id"]})
        assert response.status_code == 200 and len(response.content) < 1_048_576
        assert "🚢" * 4000 in response.content.decode("utf-8-sig")
        assert large["metadata"]["title"] not in response.headers["content-disposition"]
