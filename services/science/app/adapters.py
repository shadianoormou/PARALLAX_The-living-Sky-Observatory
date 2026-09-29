"""Input adapter boundary for future public astronomy data.

No archive URLs or live endpoints are invented here. A future adapter must
return the same Observation contract and attach source-specific provenance.
"""

from __future__ import annotations

from typing import Protocol

from .synthetic import Observation, generate_synthetic_dataset


class ObservationPairAdapter(Protocol):
    source_name: str

    def load_pair(self) -> tuple[Observation, Observation]:
        """Load two observations with validated metadata."""


class SyntheticDemoAdapter:
    source_name = "parallax-synthetic-v1"

    def __init__(self, seed: int = 2026, background_sigma: float = 1.0) -> None:
        self.seed = seed
        self.background_sigma = background_sigma

    def load_pair(self) -> tuple[Observation, Observation]:
        dataset = generate_synthetic_dataset(seed=self.seed, background_sigma=self.background_sigma)
        return dataset.epoch_a, dataset.epoch_b


class FutureArchiveAdapter:
    """Placeholder contract for a real archive adapter; intentionally not wired."""

    source_name = "future-archive-adapter"

    def load_pair(self) -> tuple[Observation, Observation]:
        raise NotImplementedError(
            "Configure a verified archive client and provenance mapping before loading real observations."
        )
