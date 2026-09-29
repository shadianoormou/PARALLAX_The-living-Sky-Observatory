import type { Measurement, Spectrum } from './parallax-api';

function getNumber(measurements: Measurement[], metricName: string) {
  return measurements.find((measurement) => measurement.metricName === metricName)?.value ?? null;
}

function getArray(measurements: Measurement[], metricName: string) {
  const value = measurements.find((measurement) => measurement.metricName === metricName)?.metadata;
  return Array.isArray(value) && value.every((item) => typeof item === 'number') ? value as number[] : null;
}

export type ExplanationRecord = {
  classification: string;
  interpretation: string;
  measurements: Measurement[];
  spectrum: Spectrum | null;
};

export type SpectralMetrics = {
  deltaRms: number;
  meanAbsoluteDelta: number;
  normalizedDelta: number;
  wavelengthCount: number;
};

export function spectralMetrics(spectrum: Spectrum | null): SpectralMetrics | null {
  if (!spectrum || spectrum.fluxEpochA.length !== spectrum.fluxEpochB.length || spectrum.fluxEpochA.length === 0) return null;
  const deltas = spectrum.fluxEpochB.map((value, index) => value - spectrum.fluxEpochA[index]);
  const deltaRms = Math.sqrt(deltas.reduce((sum, value) => sum + value ** 2, 0) / deltas.length);
  const meanAbsoluteDelta = deltas.reduce((sum, value) => sum + Math.abs(value), 0) / deltas.length;
  const referenceScale = spectrum.fluxEpochA.reduce((sum, value) => sum + Math.abs(value), 0) / spectrum.fluxEpochA.length;
  return { deltaRms, meanAbsoluteDelta, normalizedDelta: deltaRms / Math.max(referenceScale, 1e-9), wavelengthCount: spectrum.wavelengthUm.length };
}

export function buildCandidateExplanation(record: ExplanationRecord) {
  const displacement = getArray(record.measurements, 'measurement.displacement_arcsec_xy');
  const deltaFlux = getNumber(record.measurements, 'measurement.delta_flux');
  const relativeChange = getNumber(record.measurements, 'measurement.relative_change');
  const snr = getNumber(record.measurements, 'quality.component_snr');
  const shapeRatio = getNumber(record.measurements, 'measurement.shape_ratio') ?? getNumber(record.measurements, 'quality.shape_ratio');
  const threshold = getNumber(record.measurements, 'quality.promotion_threshold_sigma');
  const spectrum = spectralMetrics(record.spectrum);
  const parts: string[] = [];

  if (record.classification === 'apparent_motion' && displacement) {
    parts.push(`After registration, this source showed a measured positional shift of ${format(displacement[0])} × ${format(displacement[1])} arcsec.`);
  } else if (record.classification === 'brightness_change' && deltaFlux !== null && relativeChange !== null) {
    parts.push(`After registration, its measured flux changed by ${format(deltaFlux)} relative units (${format(relativeChange * 100, 1)}%).`);
  } else if (record.classification === 'likely_artifact') {
    parts.push(`The residual is elongated (shape ratio ${shapeRatio === null ? 'not stored' : format(shapeRatio)}) rather than consistent with the promoted source morphology.`);
  } else if (record.classification === 'uncertain') {
    parts.push(`The residual is low signal-to-noise${snr === null ? '' : ` (measured SNR ${format(snr)})`}.`);
  } else {
    parts.push('The stored measurements do not support a more specific change summary.');
  }

  if (spectrum) {
    parts.push(spectrum.normalizedDelta < 0.05
      ? `Its ${spectrum.wavelengthCount}-sample spectral profile remained broadly similar (normalized difference ${format(spectrum.normalizedDelta, 3)}).`
      : `Its ${spectrum.wavelengthCount}-sample spectral profile also changed (normalized difference ${format(spectrum.normalizedDelta, 3)}).`);
  } else {
    parts.push('No stored spectrum is available for this candidate.');
  }

  if (record.classification === 'likely_artifact') {
    parts.push('Parallax keeps this as a likely artifact and does not promote it for classification.');
  } else if (record.classification === 'uncertain') {
    parts.push(`The evidence remains below the ${threshold === null ? 'promotion' : `${format(threshold, 1)}σ promotion`} threshold and requires additional verification.`);
  } else {
    parts.push('The result is a candidate interpretation requiring additional verification, not a scientific discovery.');
  }

  return parts.join(' ');
}

function format(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}
