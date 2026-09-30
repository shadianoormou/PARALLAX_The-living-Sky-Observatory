from fastapi.testclient import TestClient
import time

import services.science.app.main as science_main
from services.science.app.main import app


client = TestClient(app)


def test_processing_endpoints_return_structured_measurements() -> None:
    for path in ("/process/register", "/process/difference", "/process/detect", "/process/analyze"):
        response = client.post(path, json={"dataset": "synthetic-demo", "seed": 2026})
        assert response.status_code == 200
        payload = response.json()
        assert payload["dataset_label"] == "DEMONSTRATION DATASET"
        assert "ground_truth" not in str(payload)


def test_processing_request_rejects_unknown_dataset() -> None:
    response = client.post("/process/detect", json={"dataset": "nasa-live-feed"})
    assert response.status_code == 422


def test_comparison_guard_endpoint_blocks_incompatible_metadata() -> None:
    response = client.post(
        "/comparison/assess",
        json={
            "epoch_a": {"shape": [128, 128], "coordinate_frame": "icrs", "pixel_scale_arcsec": 0.4, "bands": ["S1"]},
            "epoch_b": {"shape": [128, 128], "coordinate_frame": "galactic", "pixel_scale_arcsec": 0.4, "bands": ["S1"]},
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "COMPARISON NOT RELIABLE"


def test_validation_endpoint_returns_measured_cases() -> None:
    response = client.post("/validate/run")
    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == {"passed": 5, "failed": 0, "total": 5}


def test_evidence_graph_job_is_queued_and_pollable(monkeypatch) -> None:
    def fake_graph(target, bands, **kwargs):
        return {"suite": "PARALLAX X SPHEREx Evidence Graph", "target": target, "summary": {"bands_requested": len(bands)}, "bands": [], "graph": {"nodes": [], "edges": []}}

    monkeypatch.setattr(science_main, "build_spherex_evidence_graph", fake_graph)
    queued = client.post("/archive/spherex/evidence-graph/jobs", json={"ra_deg": 10, "dec_deg": -20, "bands": ["SPHEREx-D3", "SPHEREx-D4"]})
    assert queued.status_code == 202
    job_id = queued.json()["job_id"]
    assert queued.json()["status"] in {"queued", "processing", "complete"}

    status = None
    for _ in range(20):
        status = client.get(f"/archive/spherex/evidence-graph/jobs/{job_id}").json()
        if status["status"] == "complete":
            break
        time.sleep(0.01)
    assert status is not None and status["status"] == "complete"
    assert status["result"]["summary"]["bands_requested"] == 2
