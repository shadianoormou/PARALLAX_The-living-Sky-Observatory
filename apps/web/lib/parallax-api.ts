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

export type CommunityMetrics = {
  totalReviews: number;
  uniqueReviewers: number;
  candidatesReviewed: number;
  candidatesWithConsensus: number;
  averageWinningAgreement: number;
  labels: Array<{ label: string; count: number }>;
  firstReviewAtUtc: string | null;
  lastReviewAtUtc: string | null;
};

export type ResearchFeedbackMetrics = {
  totalFeedback: number;
  signals: Array<{ label: string; count: number }>;
  uniqueParticipants: number;
  roles: Array<{ label: string; count: number }>;
  languages: Array<{ label: string; count: number }>;
  regions: Array<{ label: string; count: number }>;
  minimumParticipants: number;
  recommendedParticipants: number;
  pilotStatus: 'not-started' | 'in-progress' | 'minimum-reached' | string;
  firstFeedbackAtUtc: string | null;
  lastFeedbackAtUtc: string | null;
};

export type PublicEvidenceBundleCreated = {
  bundleId: string;
  publicPath: string;
  createdAtUtc: string;
  expiresAtUtc: string;
};

export type PublicEvidenceBundle = PublicEvidenceBundleCreated & {
  title: string;
  payload: JsonObject;
};

export type ConsensusReportItem = {
  candidateId: string;
  candidateKey: string;
  scientificClassification: string;
  status: string;
  totalVotes: number;
  leadingLabel: string | null;
  leadingVotes: number;
  agreementFraction: number;
  labels: Array<{ label: string; count: number }>;
  calculatedAtUtc: string | null;
};

export type ConsensusReport = {
  candidatesReviewed: number;
  totalVotes: number;
  candidatesWithConsensus: number;
  averageAgreement: number;
  items: ConsensusReportItem[];
};

export type SpherexValidationRequest = {
  fields: Array<{
    label: string;
    ra_deg: number;
    dec_deg: number;
    radius_deg?: number;
    collection?: string;
    band?: string;
    cutout_size_deg?: number;
    max_results?: number;
  }>;
};

export type SpherexValidationReport = {
  suite: string;
  mode: string;
  requested_fields: number;
  ready_fields: number;
  caution_fields: number;
  blocked_fields: number;
  error_fields: number;
  results: Array<{ label: string; status: string; epochs: string[]; candidate_count: number; screened_count: number; quality: JsonObject; error?: string }>;
  limitations: string[];
};

export type SpherexEvidenceGraphRequest = {
  ra_deg: number;
  dec_deg: number;
  radius_deg?: number;
  collection?: string;
  bands: string[];
  cutout_size_deg?: number;
  max_results?: number;
};

export type SpherexEvidenceBand = {
  band: string;
  status: string;
  query: JsonObject;
  epochs: string[];
  candidate_count: number;
  screened_count: number;
  quality: JsonObject;
  candidates: Array<JsonObject>;
  screened_candidates: Array<JsonObject>;
  elapsed_seconds: number;
  cache_hit?: boolean;
  error?: string;
};

export type SpherexEvidenceGraph = {
  suite: string;
  mode: string;
  target: { ra_deg: number; dec_deg: number };
  summary: {
    bands_requested: number;
    bands_ready: number;
    bands_caution: number;
    bands_blocked: number;
    bands_error: number;
    total_candidates: number;
    bands_with_candidates: number;
    consistency_status: string;
    matched_candidate_groups: number;
    processing_mode: string;
    elapsed_seconds: number;
    slowest_band_seconds: number;
    cache_hits: number;
  };
  bands: SpherexEvidenceBand[];
  cross_band_consistency: {
    status: string;
    matched_groups: Array<{ group_id: string; bands: string[]; candidate_ids: string[]; position_normalized: number[] }>;
    method: string;
  };
  graph: { nodes: Array<JsonObject>; edges: Array<JsonObject> };
  limitations: string[];
};

export type SpherexEvidenceGraphJob = {
  job_id: string;
  status: 'queued' | 'processing' | 'complete' | 'error' | string;
  requested_bands: number;
  created_at_utc: string;
  updated_at_utc: string;
  poll_url?: string;
  result?: SpherexEvidenceGraph;
  error?: string;
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

export type SpherexArchiveRequest = {
  ra_deg: number;
  dec_deg: number;
  radius_deg: number;
  collection: string;
  band?: string;
  cutout_size_deg: number;
  max_results: number;
};

export type SpherexArchiveRecord = {
  observation_id: string;
  band: string;
  access_url: string;
  ra_deg: number;
  dec_deg: number;
  pixel_scale_arcsec: number;
  t_min_mjd: number;
  t_max_mjd: number;
  wavelength_um: [number | null, number | null];
  release_date: string | null;
};

export type SpherexArchiveSearch = {
  source: string;
  query: SpherexArchiveRequest;
  records: SpherexArchiveRecord[];
};

export type SpherexPreview = {
  width: number;
  height: number;
  pixels: number[];
  display_min: number;
  display_max: number;
  stride: number;
};

export type SpherexArchiveAnalysis = {
  source: string;
  manifest: JsonObject;
  previews: { a: SpherexPreview; b: SpherexPreview };
  analysis: {
    dataset_label: string;
    epochs: { a: JsonObject; b: JsonObject };
    comparison: ComparisonAssessment;
    registration: JsonObject;
    difference: JsonObject;
    candidates: Array<{ candidate_id: string; classification: string; measurement: JsonObject; quality: JsonObject; interpretation: string }>;
    screened_candidates: Array<{ candidate_id: string; classification: string; status: string; interpretation: string }>;
    processing_blocked?: boolean;
  };
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
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'X-Demo-User': demoUser, ...(apiKey ? { 'X-API-Key': apiKey } : {}), ...(init?.headers ?? {}) },
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
  getCommunityMetrics: () => fetchJson<CommunityMetrics>('/api/community/metrics'),
  getResearchFeedbackMetrics: () => fetchJson<ResearchFeedbackMetrics>('/api/research-feedback/metrics'),
  submitResearchFeedback: (signal: 'useful' | 'unclear' | 'would-share', notes?: string, role: 'student' | 'teacher' | 'researcher' = 'researcher', language: 'en' | 'bn' = 'en', region = 'unspecified') => fetchJson<{ signal: string; recordedAtUtc: string }>('/api/research-feedback', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ surface: 'parallax-x', signal, notes, role, language, region }),
  }),
  getConsensusReport: () => fetchJson<ConsensusReport>('/api/community/consensus-report'),
  createPublicEvidenceBundle: (title: string, payload: JsonObject) => fetchJson<PublicEvidenceBundleCreated>('/api/public-evidence-bundles', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, payload }),
  }),
  getPublicEvidenceBundle: (id: string) => fetchJson<PublicEvidenceBundle>(`/api/public-evidence-bundles/${encodeURIComponent(id)}`),
  completeLearningModule: (moduleKey: string) => fetchJson<Passport>(`/api/passport/modules/${moduleKey}`, { method: 'POST' }),
  getValidation: () => fetchJson<ValidationReport>('/api/validation'),
  searchSpherex: (request: SpherexArchiveRequest) => fetchJson<SpherexArchiveSearch>('/api/archive/spherex/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
  }),
  analyzeSpherex: (request: SpherexArchiveRequest) => fetchJson<SpherexArchiveAnalysis>('/api/archive/spherex/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
  }),
  validateSpherex: (request: SpherexValidationRequest) => fetchJson<SpherexValidationReport>('/api/archive/spherex/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
  }),
  evidenceGraphSpherex: (request: SpherexEvidenceGraphRequest) => fetchJson<SpherexEvidenceGraph>('/api/archive/spherex/evidence-graph', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
  }),
  queueEvidenceGraphSpherex: (request: SpherexEvidenceGraphRequest) => fetchJson<SpherexEvidenceGraphJob>('/api/archive/spherex/evidence-graph/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
  }),
  getEvidenceGraphJob: (jobId: string) => fetchJson<SpherexEvidenceGraphJob>(`/api/archive/spherex/evidence-graph/jobs/${encodeURIComponent(jobId)}`),
};

export function getNumber(measurements: Measurement[], metricName: string) {
  return measurements.find((measurement) => measurement.metricName === metricName)?.value ?? null;
}

export function getArray(measurements: Measurement[], metricName: string) {
  const value = measurements.find((measurement) => measurement.metricName === metricName)?.metadata;
  return Array.isArray(value) && value.every((item) => typeof item === 'number') ? value as number[] : null;
}
