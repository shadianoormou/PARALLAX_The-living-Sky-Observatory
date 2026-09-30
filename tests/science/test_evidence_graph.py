from __future__ import annotations

from services.science.app.adapters import ArchiveAdapterError, SpherexPair
from services.science.app.evidence_graph import _candidate_anchor, build_spherex_evidence_graph
from services.science.app.synthetic import generate_synthetic_dataset


class FakeAdapter:
    def __init__(self, pair: SpherexPair):
        self.pair = pair

    def load_pair_with_records(self) -> SpherexPair:
        return self.pair


def test_evidence_graph_preserves_each_band_and_null_result():
    dataset = generate_synthetic_dataset(seed=2026)
    records = (
        type("Record", (), {"observation_id": "D3-A"})(),
        type("Record", (), {"observation_id": "D3-B"})(),
    )
    pair = SpherexPair(dataset.epoch_a, dataset.epoch_b, records)

    def factory(**query):
        assert query["band"] in {"SPHEREx-D3", "SPHEREx-D4"}
        return FakeAdapter(pair)

    report = build_spherex_evidence_graph({"ra_deg": 10, "dec_deg": -20}, ["SPHEREx-D3", "SPHEREx-D4"], adapter_factory=factory)

    assert report["summary"]["bands_requested"] == 2
    assert report["summary"]["bands_ready"] == 2
    assert len(report["bands"]) == 2
    assert all(item["epochs"] == ["D3-A", "D3-B"] for item in report["bands"])
    assert any(edge["relation"] == "measured" for edge in report["graph"]["edges"])
    assert any(node["type"] == "quality" for node in report["graph"]["nodes"])
    assert report["summary"]["consistency_status"] == "MULTI-BAND PIXEL-ALIGNED"
    assert report["summary"]["matched_candidate_groups"] == 2


def test_evidence_graph_keeps_archive_errors_visible():
    def factory(**query):
        raise ArchiveAdapterError(f"no usable product for {query['band']}")

    report = build_spherex_evidence_graph({"ra_deg": 10, "dec_deg": -20}, ["SPHEREx-D3", "SPHEREx-D4"], adapter_factory=factory)

    assert report["summary"]["bands_error"] == 2
    assert all(item["status"] == "ERROR" for item in report["bands"])
    assert len([node for node in report["graph"]["nodes"] if node["type"] == "error"]) == 2
    assert report["cross_band_consistency"]["status"] == "NO PROMOTED CANDIDATES"


def test_candidate_anchor_prefers_complete_wcs_metadata():
    anchor = _candidate_anchor(
        {"measurement": {"position_xy": [10.0, 10.0]}},
        {"wcs": {"CTYPE1": "RA---TAN", "CTYPE2": "DEC--TAN", "CRVAL1": 127.0, "CRVAL2": -39.0, "CRPIX1": 10.0, "CRPIX2": 10.0, "CDELT1": -0.0001, "CDELT2": 0.0001}},
        (20, 20),
    )

    assert anchor is not None
    assert anchor["coordinate_mode"] == "wcs"
    assert len(anchor["world_position"]) == 2
