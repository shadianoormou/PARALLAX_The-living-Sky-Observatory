export type JsonObject = Record<string, unknown>;

export type Region = {
  id: string;
  name: string;
  centerRightAscensionDeg: number;
  centerDeclinationDeg: number;
  widthPixels: number;
  heightPixels: number;
  observationCount: number;
  candidateCount: number;
};

export type CandidateListItem = {
  id: string;
  candidateKey: string;
  classification: string;
  interpretation: string;
  status: string;
  createdAtUtc: string;
};

export type CandidateDetail = CandidateListItem & {
  processingRunId: string;
  datasetLabel: string;
};

export type Measurement = {
  id: string;
  metricName: string;
  value: number | null;
  unit: string | null;
  uncertainty: number | null;
  metadata: unknown;
};

export type Spectrum = {
  id: string;
  sourceId: string;
  wavelengthUm: number[];
  fluxEpochA: number[];
  fluxEpochB: number[];
  deltaFlux: number[];
  interpretation: string;
};

export type CandidateRecord = {
  detail: CandidateDetail;
  measurements: Measurement[];
  spectrum: Spectrum | null;
  provenance: Provenance;
};

export type Provenance = {
  candidateId: string;
  datasetLabel: string;
  datasetType: string;
  sourceIdentifier: string;
  datasetProvenance: string;
  epochA: JsonObject;
  epochB: JsonObject;
  algorithmVersion: string;
  sourceCreatedAtUtc: string;
  retrievalTimestampUtc: string | null;
  processingStartedAtUtc: string;
  processingCompletedAtUtc: string | null;
  comparison: ComparisonAssessment | null;
};

export type ComparisonAssessment = {
  processingRunId: string;
  status: 'READY TO COMPARE' | 'COMPARE WITH CAUTION' | 'COMPARISON NOT RELIABLE' | string;
  reasons: string[];
  blockingIssues: string[];
  warnings: string[];
  skyOverlapFraction: number | null;
  registrationError: number | null;
  createdAtUtc: string;
};

export type DemoRun = {
  id: string;
  status: string;
  algorithmVersion: string;
  startedAtUtc: string;
  completedAtUtc: string | null;
  candidateCount: number;
};

export type ClassificationRequest = {
  candidate_id: string;
  label: string;
  notes?: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type Consensus = {
  candidateId: string;
  classificationLabel: string;
  voteCount: number;
  totalVotes: number;
  agreementFraction: number;
  calculatedAtUtc: string;
};

export type Passport = {
  objectsInspected: number;
  candidatesReviewed: number;
  regionsExplored: number;
  consensusMatches: number;
  artifactsIdentified: number;
  learningModulesCompleted: number;
  learningModules: string[];
  achievements: Achievement[];
};

export type Achievement = {
  key: string;
  name: string;
  description: string;
  earnedAtUtc: string;
};

export type ValidationCase = {
  id: string;
  label: string;
  expected: string;
  detected: string;
  error: number | null;
  status: 'PASS' | 'FAIL' | string;
};

export type ValidationReport = {
  suite: string;
  dataset_label: string;
  generated_at_utc: string;
  cases: ValidationCase[];
  summary: { passed: number; failed: number; total: number };
  limitations: string[];
};

export class ParallaxApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ParallaxApiError';
    this.status = status;
  }
}

const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5080').replace(/\/$/, '');

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const demoUser = typeof window !== 'undefined' ? window.localStorage.getItem('parallax-demo-user') ?? 'demo-user' : 'demo-user';
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'X-Demo-User': demoUser, ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!response.ok) {
    let detail = `The observatory service returned ${response.status}.`;
    try {
      const body = await response.json() as { detail?: string; title?: string };
      detail = body.detail ?? body.title ?? detail;
    } catch {
      // Keep the stable status message when the service did not return JSON.
    }
    throw new ParallaxApiError(detail, response.status);
  }
  return response.json() as Promise<T>;
}

export const parallaxApi = {
  listRegions: () => fetchJson<Region[]>('/api/regions'),
  runDemo: (seed = 2026) => fetchJson<DemoRun>('/api/demo/run-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset: 'synthetic-demo', seed, background_sigma: 1 }),
  }),
  listCandidates: () => fetchJson<CandidateListItem[]>('/api/candidates'),
  getCandidate: (id: string) => fetchJson<CandidateDetail>(`/api/candidates/${id}`),
  getMeasurements: (id: string) => fetchJson<Measurement[]>(`/api/candidates/${id}/measurements`),
  getSpectrum: (id: string) => fetchJson<Spectrum[]>(`/api/candidates/${id}/spectrum`),
  getProvenance: (id: string) => fetchJson<Provenance>(`/api/candidates/${id}/provenance`),
  getRecord: async (id: string): Promise<CandidateRecord> => {
    const [detail, measurements, spectrum, provenance] = await Promise.all([
      fetchJson<CandidateDetail>(`/api/candidates/${id}`),
      fetchJson<Measurement[]>(`/api/candidates/${id}/measurements`),
      fetchJson<Spectrum[]>(`/api/candidates/${id}/spectrum`),
      fetchJson<Provenance>(`/api/candidates/${id}/provenance`),
    ]);
    return { detail, measurements, spectrum: spectrum[0] ?? null, provenance };
  },
  submitClassification: (body: ClassificationRequest) => fetchJson<{ id: string; candidateId: string; label: string; confidence: string | null; createdAtUtc: string }>('/api/classifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  getConsensus: (id: string) => fetchJson<Consensus[]>(`/api/candidates/${id}/consensus`),
  getPassport: () => fetchJson<Passport>('/api/passport'),
  completeLearningModule: (moduleKey: string) => fetchJson<Passport>(`/api/passport/modules/${moduleKey}`, { method: 'POST' }),
  getValidation: () => fetchJson<ValidationReport>('/api/validation'),
};

export function getNumber(measurements: Measurement[], metricName: string) {
  return measurements.find((measurement) => measurement.metricName === metricName)?.value ?? null;
}

export function getArray(measurements: Measurement[], metricName: string) {
  const value = measurements.find((measurement) => measurement.metricName === metricName)?.metadata;
  return Array.isArray(value) && value.every((item) => typeof item === 'number') ? value as number[] : null;
}
