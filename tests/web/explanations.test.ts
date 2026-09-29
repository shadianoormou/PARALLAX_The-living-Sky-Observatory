import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCandidateExplanation, spectralMetrics } from '../../apps/web/lib/explanations.ts';

const measurement = (metricName: string, value: number | null, metadata: unknown = value) => ({ id: metricName, metricName, value, unit: null, uncertainty: null, metadata });

test('motion explanation uses stored displacement and stable spectrum', () => {
  const text = buildCandidateExplanation({
    classification: 'apparent_motion',
    interpretation: 'possible apparent motion; requires additional verification',
    measurements: [measurement('measurement.displacement_arcsec_xy', null, [1.83, -1.32]), measurement('quality.component_snr', 11.1)],
    spectrum: { id: 's', sourceId: 'moving-source', wavelengthUm: [1, 2], fluxEpochA: [0.7, 0.9], fluxEpochB: [0.7, 0.9], deltaFlux: [0, 0], interpretation: 'sample comparison' },
  });
  assert.match(text, /1\.83 × -1\.32 arcsec/);
  assert.match(text, /remained broadly similar/);
  assert.match(text, /additional verification/);
});

test('uncertain explanation does not imply confidence', () => {
  const text = buildCandidateExplanation({
    classification: 'uncertain',
    interpretation: 'low-SNR residual',
    measurements: [measurement('quality.component_snr', 4.39), measurement('quality.promotion_threshold_sigma', 5)],
    spectrum: null,
  });
  assert.match(text, /measured SNR 4\.39/);
  assert.match(text, /below the 5\.0σ promotion threshold/);
  assert.doesNotMatch(text, /confidence|probability/i);
});

test('spectral metrics describe variable spectra as measured differences', () => {
  const metrics = spectralMetrics({ id: 's', sourceId: 'variable-source', wavelengthUm: [1, 2], fluxEpochA: [1, 1], fluxEpochB: [2, 2], deltaFlux: [1, 1], interpretation: 'sample comparison' });
  assert.equal(metrics?.normalizedDelta, 1);
  assert.equal(metrics?.wavelengthCount, 2);
});
