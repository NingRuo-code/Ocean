import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("inventory_runtime", Path(__file__).parents[1] / "inventory-runtime.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_local_inventory_distinguishes_missing_from_empty_and_never_claims_server(tmp_path):
    raw = tmp_path / "data/raw"
    raw.mkdir(parents=True)
    hot = tmp_path / "frontend/prototype/data"
    hot.mkdir(parents=True)
    (hot / "example.js").write_bytes(b"abc")
    report = module.inventory(tmp_path, {"snapshot_id": "sha256:fixture"})
    assert report["layers"]["raw"]["bytes"] == 0
    assert report["layers"]["hot_display"]["bytes"] == 3
    assert report["layers"]["cache"]["bytes"] is None
    assert report["production"]["ram"] is None
    assert report["capacity"]["concurrency_budget"] is None
    assert str(tmp_path) not in str(report)
