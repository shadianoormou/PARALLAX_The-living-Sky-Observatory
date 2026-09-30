from __future__ import annotations

from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .adapters import ArchiveAdapterError, SpherexIrsaAdapter, image_preview
from .archive_validation import SpherexValidationField, validate_spherex_fields
from .pipeline import ObservationValidationError, analyze_observations, assess_comparison_metadata, detect_candidates, difference_observations, register_observations, run_validation_suite
from .serialization import difference_summary, registration_summary
from .synthetic import DEFAULT_SEED, generate_synthetic_dataset


class ProcessRequest(BaseModel):
    dataset: Literal["synthetic-demo"] = "synthetic-demo"
    seed: int = Field(DEFAULT_SEED, ge=0, le=2_147_483_647)
    background_sigma: float = Field(1.0, gt=0, le=10)


class ComparisonAssessmentRequest(BaseModel):
    epoch_a: dict[str, Any]
    epoch_b: dict[str, Any]
    registration_error: float | None = Field(default=None, ge=0)


class SpherexArchiveRequest(BaseModel):
    ra_deg: float = Field(..., ge=-360, le=360)
    dec_deg: float = Field(..., ge=-90, le=90)
    radius_deg: float = Field(0.01, gt=0, le=2)
    collection: str = Field("spherex_qr2", pattern=r"^spherex_qr[23](?:_deep)?$")
    band: str | None = Field(default=None, min_length=1, max_length=40)
    cutout_size_deg: float = Field(0.1, ge=0.01, le=1)
    max_results: int = Field(50, ge=2, le=200)


class SpherexValidationFieldRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=60)
    ra_deg: float = Field(..., ge=-360, le=360)
    dec_deg: float = Field(..., ge=-90, le=90)
    radius_deg: float = Field(0.001, gt=0, le=2)
    collection: str = Field("spherex_qr2", pattern=r"^spherex_qr[23](?:_deep)?$")
    band: str | None = Field(default="SPHEREx-D3", min_length=1, max_length=40)
    cutout_size_deg: float = Field(0.03, ge=0.01, le=1)
    max_results: int = Field(20, ge=2, le=200)


class SpherexValidationRequest(BaseModel):
    fields: list[SpherexValidationFieldRequest] = Field(..., min_length=2, max_length=12)

app = FastAPI(
    title="PARALLAX Science Service",
    version="0.2.0",
    description="Measurement service for the deterministic synthetic demonstration dataset.",
)


def _dataset(request: ProcessRequest):
    return generate_synthetic_dataset(seed=request.seed, background_sigma=request.background_sigma)


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": "parallax-science", "status": "ok", "phase": "scientific-engine"}


@app.get("/api/v1/health")
def versioned_health() -> dict[str, str]:
    return {"service": "parallax-science", "status": "ok", "phase": "scientific-engine"}


@app.post("/comparison/assess")
def comparison_assess(request: ComparisonAssessmentRequest) -> dict:
    return assess_comparison_metadata(request.epoch_a, request.epoch_b, request.registration_error)


@app.post("/validate/run")
def validate_run() -> dict:
    return run_validation_suite()


@app.post("/archive/spherex/search")
def spherex_search(request: SpherexArchiveRequest) -> dict:
    """Discover real SPHEREx products without downloading image bytes."""

    adapter = SpherexIrsaAdapter(**request.model_dump())
    try:
        records = adapter.query_records()
    except (ArchiveAdapterError, ValueError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return {
        "source": adapter.source_name,
        "query": request.model_dump(),
        "records": [
            {
                "observation_id": record.observation_id,
                "band": record.band,
                "access_url": record.access_url,
                "ra_deg": record.ra_deg,
                "dec_deg": record.dec_deg,
                "pixel_scale_arcsec": record.pixel_scale_arcsec,
                "t_min_mjd": record.t_min_mjd,
                "t_max_mjd": record.t_max_mjd,
                "wavelength_um": [record.em_min_um, record.em_max_um],
                "release_date": record.obs_release_date,
            }
            for record in records
        ],
    }


@app.post("/archive/spherex/analyze")
def spherex_analyze(request: SpherexArchiveRequest) -> dict:
    """Load two real archive cutouts and run the same guarded detector."""

    adapter = SpherexIrsaAdapter(**request.model_dump())
    try:
        pair = adapter.load_pair_with_records()
        analysis = analyze_observations(pair.epoch_a, pair.epoch_b)
    except (ArchiveAdapterError, ObservationValidationError, ValueError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return {
        "source": adapter.source_name,
        "manifest": adapter.provenance_manifest(pair),
        "previews": {
            "a": image_preview(pair.epoch_a.image),
            "b": image_preview(pair.epoch_b.image),
        },
        "analysis": analysis,
    }


@app.post("/archive/spherex/validate")
def spherex_validate(request: SpherexValidationRequest) -> dict:
    """Run the real-data quality workflow independently across multiple fields."""

    fields = [SpherexValidationField(**field.model_dump()) for field in request.fields]
    return validate_spherex_fields(fields)


@app.post("/process/register")
def process_register(request: ProcessRequest = ProcessRequest()) -> dict:
    dataset = _dataset(request)
    try:
        result = register_observations(dataset.epoch_a, dataset.epoch_b)
    except ObservationValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return registration_summary(result, dataset.epoch_a, dataset.epoch_b)


@app.post("/process/difference")
def process_difference(request: ProcessRequest = ProcessRequest()) -> dict:
    dataset = _dataset(request)
    try:
        result = difference_observations(dataset.epoch_a, dataset.epoch_b)
    except ObservationValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return difference_summary(result, dataset.epoch_a, dataset.epoch_b)


@app.post("/process/detect")
def process_detect(request: ProcessRequest = ProcessRequest()) -> dict:
    dataset = _dataset(request)
    try:
        result = difference_observations(dataset.epoch_a, dataset.epoch_b)
        candidates = detect_candidates(dataset.epoch_a, dataset.epoch_b, result)
    except ObservationValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {
        "dataset_label": dataset.epoch_a.metadata["dataset_label"],
        "threshold_sigma": 5.0,
        "candidate_count": len(candidates),
        "candidates": candidates,
    }


@app.post("/process/analyze")
def process_analyze(request: ProcessRequest = ProcessRequest()) -> dict:
    dataset = _dataset(request)
    try:
        return analyze_observations(dataset.epoch_a, dataset.epoch_b)
    except ObservationValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
