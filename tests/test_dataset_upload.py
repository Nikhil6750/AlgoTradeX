from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from backend.server import app


def test_upload_dataset_returns_dataset_id_and_row_count(monkeypatch, tmp_path):
    monkeypatch.setattr("backend.api.dataset_routes.DATASETS_DIR", str(tmp_path))
    monkeypatch.setattr("backend.services.backtest_service.DATASETS_DIR", tmp_path)

    client = TestClient(app)
    csv_content = "\n".join([
        "timestamp,open,high,low,close",
        "2024-01-01T00:00:00Z,1.0,1.1,0.9,1.05",
        "2024-01-01T00:05:00Z,1.05,1.2,1.0,1.15",
    ])

    response = client.post(
        "/datasets/upload",
        files={"file": ("sample.csv", csv_content, "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset_id"]
    assert payload["rows"] == 2
    assert (tmp_path / f"{payload['dataset_id']}.csv").exists()


def test_upload_dataset_rejects_missing_required_columns(monkeypatch, tmp_path):
    monkeypatch.setattr("backend.api.dataset_routes.DATASETS_DIR", str(tmp_path))
    monkeypatch.setattr("backend.services.backtest_service.DATASETS_DIR", tmp_path)

    client = TestClient(app)
    csv_content = "\n".join([
        "timestamp,open,high,close",
        "2024-01-01T00:00:00Z,1.0,1.1,1.05",
    ])

    response = client.post(
        "/datasets/upload",
        files={"file": ("invalid.csv", csv_content, "text/csv")},
    )

    assert response.status_code == 400
    assert "Missing required columns" in response.json()["error"]
