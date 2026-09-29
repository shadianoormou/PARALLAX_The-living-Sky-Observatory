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
