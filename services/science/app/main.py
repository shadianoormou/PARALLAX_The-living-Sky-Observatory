from __future__ import annotations

from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

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
