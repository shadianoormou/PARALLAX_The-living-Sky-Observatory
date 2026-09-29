import type { CandidateDetail, CandidateListItem, CandidateRecord, Measurement, Provenance, Region, Spectrum } from './parallax-api';

type DemoItem = {
  candidate_id: string;
  classification: string;
  status?: string;
  measurement: Record<string, unknown>;
  quality: Record<string, unknown>;
  interpretation: string;
};

type DemoSummary = {
  dataset_label: string;
  generated_at_utc: string;
  epochs: { a: Record<string, unknown>; b: Record<string, unknown> };
  candidates: DemoItem[];
  screened_candidates: DemoItem[];
  spectral_comparison: Array<{
    source_id: string;
    wavelength_um: number[];
    flux_epoch_a: number[];
    flux_epoch_b: number[];
    delta_flux: number[];
    interpretation: string;
  }>;
  provenance_statement: string;
};

export type PrecomputedDemo = {
  region: Region;
  candidates: CandidateListItem[];
  records: Record<string, CandidateRecord>;
};

function numericValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function measurements(item: DemoItem): Measurement[] {
  return [
    ...Object.entries(item.measurement).map(([key, value]) => ({ key: `measurement.${key}`, value })),
    ...Object.entries(item.quality).map(([key, value]) => ({ key: `quality.${key}`, value })),
  ].map(({ key, value }, index) => ({
    id: `precomputed-${item.candidate_id}-${index}`,
    metricName: key,
    value: numericValue(value),
    unit: key.includes('arcsec') ? 'arcsec' : key.includes('pixels') ? 'pixels' : null,
    uncertainty: null,
    metadata: value,
  }));
}

function spectrumFor(item: DemoItem, spectra: DemoSummary['spectral_comparison']): Spectrum | null {
  const sourceId = item.classification === 'apparent_motion' ? 'moving-source' : item.classification === 'brightness_change' ? 'variable-source' : null;
  const source = sourceId ? spectra.find((candidate) => candidate.source_id === sourceId) : undefined;
  return source ? {
    id: `precomputed-spectrum-${source.source_id}`,
    sourceId: source.source_id,
    wavelengthUm: source.wavelength_um,
    fluxEpochA: source.flux_epoch_a,
    fluxEpochB: source.flux_epoch_b,
    deltaFlux: source.delta_flux,
    interpretation: source.interpretation,
  } : null;
}

export function buildPrecomputedDemo(summary: DemoSummary): PrecomputedDemo {
  const timestamp = summary.generated_at_utc;
  const shape = Array.isArray(summary.epochs.a.shape) ? summary.epochs.a.shape : [128, 128];
  const allItems = [...summary.candidates, ...summary.screened_candidates];
  const candidates = allItems.map((item) => ({
    id: `precomputed-${item.candidate_id}`,
    candidateKey: item.classification === 'apparent_motion' ? 'PX-DEMO-017' : item.candidate_id,
    classification: item.classification,
    interpretation: item.interpretation,
    status: item.status ?? 'candidate',
    createdAtUtc: timestamp,
  }));
  const provenance = (id: string): Provenance => ({
    candidateId: id,
    datasetLabel: summary.dataset_label,
    datasetType: 'synthetic-demo',
    sourceIdentifier: String(summary.epochs.a.dataset_id ?? 'parallax-synthetic-v1'),
    datasetProvenance: summary.provenance_statement,
    epochA: summary.epochs.a,
    epochB: summary.epochs.b,
    algorithmVersion: 'science-service:0.2.0 / precomputed artifact',
    sourceCreatedAtUtc: timestamp,
    retrievalTimestampUtc: null,
    processingStartedAtUtc: timestamp,
    processingCompletedAtUtc: timestamp,
  });
  const records = Object.fromEntries(allItems.map((item, index) => {
    const listItem = candidates[index];
    const detail: CandidateDetail = { ...listItem, processingRunId: 'precomputed-demo-run', datasetLabel: summary.dataset_label };
    return [listItem.id, {
      detail,
      measurements: measurements(item),
      spectrum: spectrumFor(item, summary.spectral_comparison),
      provenance: provenance(listItem.id),
    }];
  }));
  return {
    region: {
      id: 'precomputed-demo-region',
      name: 'Synthetic tangent-plane demo region',
      centerRightAscensionDeg: 0,
      centerDeclinationDeg: 0,
      widthPixels: Number(shape[1] ?? 128),
      heightPixels: Number(shape[0] ?? 128),
      observationCount: 2,
      candidateCount: candidates.length,
    },
    candidates,
    records,
  };
}

export async function loadPrecomputedDemo(): Promise<PrecomputedDemo> {
  const response = await fetch('/api/demo-assets/summary.json', { cache: 'force-cache' });
  if (!response.ok) throw new Error('The precomputed demonstration artifact is unavailable.');
  return buildPrecomputedDemo(await response.json() as DemoSummary);
}
