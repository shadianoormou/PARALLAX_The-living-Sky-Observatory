from fastapi.testclient import TestClient

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
