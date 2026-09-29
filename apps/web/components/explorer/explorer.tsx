'use client';

import {
  AlertTriangle, CircleHelp, Crosshair, Database, Expand, Gauge, Info,
  LoaderCircle, LockKeyhole, MousePointer2, Pause, Play, RefreshCw,
  ScanSearch, Sparkles, SquareSplitHorizontal, Target, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMode } from '../mode-context';
import {
  CandidateDetail, CandidateListItem, Measurement, ParallaxApiError,
  Provenance, Region, Spectrum, getArray, getNumber, parallaxApi,
} from '../../lib/parallax-api';
import { loadPrecomputedDemo } from '../../lib/demo-fallback';

type ComparisonMode = 'blink' | 'split' | 'difference';
type DifferenceLayer = 'original' | 'registered' | 'difference' | 'residual';
type EpochCode = 'A' | 'B';
type Point = { x: number; y: number };
type PgmImage = { width: number; height: number; pixels: Uint8Array };
type CandidateRecord = {
  detail: CandidateDetail;
  measurements: Measurement[];
  spectrum: Spectrum | null;
  provenance: Provenance;
};

const ASSETS = {
  a: '/api/demo-assets/epoch-a.pgm',
  b: '/api/demo-assets/epoch-b.pgm',
  registered: '/api/demo-assets/registered.pgm',
  difference: '/api/demo-assets/difference.pgm',
  residual: '/api/demo-assets/residual.pgm',
} as const;
const LOADING_PHASES = ['ALIGNING STAR FIELD', 'NORMALIZING OBSERVATIONS', 'SEARCHING FOR CHANGES', 'MEASURING CANDIDATE'];
const BLINK_SPEEDS = { Slow: 1500, Normal: 800, Fast: 340 } as const;

function parsePgm(buffer: ArrayBuffer): PgmImage {
  const bytes = new Uint8Array(buffer);
  let cursor = 0;
  const token = (): string => {
    while (cursor < bytes.length && bytes[cursor] <= 32) cursor += 1;
    if (bytes[cursor] === 35) {
      while (cursor < bytes.length && bytes[cursor] !== 10) cursor += 1;
      return token();
    }
    const start = cursor;
    while (cursor < bytes.length && bytes[cursor] > 32) cursor += 1;
    return new TextDecoder().decode(bytes.slice(start, cursor));
  };
  if (token() !== 'P5') throw new Error('Only binary PGM sky assets are supported.');
  const width = Number(token());
  const height = Number(token());
  const maxValue = Number(token());
  while (cursor < bytes.length && bytes[cursor] <= 32) cursor += 1;
  if (!width || !height || maxValue !== 255) throw new Error('The observation asset has an unsupported format.');
  return { width, height, pixels: bytes.slice(cursor, cursor + width * height) };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberText(value: number | null | undefined, digits = 2) {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

function candidatePosition(record: CandidateRecord | undefined, epoch: EpochCode): Point | null {
  if (!record) return null;
  const motion = getArray(record.measurements, `measurement.position_${epoch === 'A' ? 'a' : 'b'}_xy`);
  if (motion && motion.length >= 2) return { x: motion[0], y: motion[1] };
  const position = getArray(record.measurements, 'measurement.position_xy');
  return position && position.length >= 2 ? { x: position[0], y: position[1] } : null;
}

function label(value: string) {
  return value.replaceAll('_', ' ');
}

export function Explorer() {
  const { expert } = useMode();
  const requestedCandidateId = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('candidate');
  const [regions, setRegions] = useState<Region[]>([]);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [records, setRecords] = useState<Record<string, CandidateRecord>>({});
  const [images, setImages] = useState<Partial<Record<keyof typeof ASSETS, PgmImage>>>({});
  const [regionId, setRegionId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [precomputed, setPrecomputed] = useState(false);

  const loadAssets = useCallback(async () => {
    const entries = await Promise.all(
      (Object.keys(ASSETS) as Array<keyof typeof ASSETS>).map(async (key) => {
        const response = await fetch(ASSETS[key], { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Observation asset ${key} is unavailable.`);
        return [key, parsePgm(await response.arrayBuffer())] as const;
      }),
    );
    return Object.fromEntries(entries) as Partial<Record<keyof typeof ASSETS, PgmImage>>;
  }, []);

  const loadCandidate = useCallback(async (candidate: CandidateListItem) => {
    const [detail, measurements, spectrum, provenance] = await Promise.all([
      parallaxApi.getCandidate(candidate.id),
      parallaxApi.getMeasurements(candidate.id),
      parallaxApi.getSpectrum(candidate.id),
      parallaxApi.getProvenance(candidate.id),
    ]);
    return { detail, measurements, spectrum: spectrum[0] ?? null, provenance };
  }, []);

  const loadObservatory = useCallback(async () => {
    setBusy(true);
    setError(null);
    setOffline(false);
    setPrecomputed(false);
    try {
      const [nextRegions, nextCandidates, nextImages] = await Promise.all([
        parallaxApi.listRegions(),
        parallaxApi.listCandidates(),
        loadAssets(),
      ]);
      setRegions(nextRegions);
      setCandidates(nextCandidates);
      setImages(nextImages);
      const initialCandidate = nextCandidates.find((candidate) => candidate.id === requestedCandidateId) ?? nextCandidates[0];
      if (nextRegions.length) setRegionId(nextRegions[0].id);
      setCandidateId(initialCandidate?.id ?? '');
      setRecords({});
      if (initialCandidate) setRecords({ [initialCandidate.id]: await loadCandidate(initialCandidate) });
    } catch (caught) {
      const message = caught instanceof ParallaxApiError
        ? caught.message
        : caught instanceof Error ? caught.message : 'The observatory could not load this field.';
      try {
        const fallback = await loadPrecomputedDemo();
        setRegions([fallback.region]);
        setCandidates(fallback.candidates);
        setRecords(fallback.records);
        setImages(await loadAssets());
        setRegionId(fallback.region.id);
        const initialFallback = fallback.candidates.find((candidate) => candidate.id === requestedCandidateId) ?? fallback.candidates[0];
        setCandidateId(initialFallback?.id ?? '');
        setPrecomputed(true);
        setOffline(true);
        setError(`API unavailable: showing the read-only precomputed demonstration artifact. (${message})`);
      } catch {
        setError(message);
        setOffline(caught instanceof TypeError || (caught instanceof ParallaxApiError && caught.status >= 500));
      }
    } finally {
      setBusy(false);
    }
  }, [loadAssets, loadCandidate, requestedCandidateId]);

  useEffect(() => { void loadObservatory(); }, [loadObservatory]);

  useEffect(() => {
    if (!candidateId || precomputed || records[candidateId]) return;
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    void loadCandidate(candidate).then((record) => setRecords((current) => ({ ...current, [candidate.id]: record }))).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'The selected candidate record could not be loaded.');
    });
  }, [candidateId, candidates, loadCandidate, precomputed, records]);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setLoadingPhase((phase) => (phase + 1) % LOADING_PHASES.length), 780);
    return () => window.clearInterval(timer);
  }, [busy]);

  const runDemo = async () => {
    setBusy(true);
    setLoadingPhase(0);
    setError(null);
    try {
      await parallaxApi.runDemo();
      await loadObservatory();
    } catch (caught) {
      try {
        const fallback = await loadPrecomputedDemo();
        setRegions([fallback.region]);
        setCandidates(fallback.candidates);
        setRecords(fallback.records);
        setImages(await loadAssets());
        setRegionId(fallback.region.id);
        setCandidateId(fallback.candidates[0]?.id ?? '');
        setPrecomputed(true);
        setOffline(true);
        setError('Live services are unavailable; loaded the read-only precomputed demonstration artifact.');
      } catch {
        setError(caught instanceof Error ? caught.message : 'The demonstration analysis could not be started.');
        setOffline(caught instanceof TypeError || (caught instanceof ParallaxApiError && caught.status >= 500));
      } finally {
        setBusy(false);
      }
    }
  };

  const region = regions.find((item) => item.id === regionId) ?? regions[0];
  const hasData = Boolean(region && candidates.length && images.a && images.b);

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[var(--void)]">
      <div className="observatory-grid mx-auto min-h-[calc(100vh-72px)] max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
        <ExplorerHeader region={region} regions={regions} regionId={regionId} setRegionId={setRegionId} refresh={loadObservatory} />
        {busy && <LoadingState phase={LOADING_PHASES[loadingPhase]} />}
        {!busy && !hasData && <OfflineState error={error} offline={offline} onStart={runDemo} onRetry={loadObservatory} />}
        {!busy && hasData && (
          <ExplorerWorkspace
            region={region}
            candidates={candidates}
            records={records}
            images={images}
            candidateId={candidateId}
            setCandidateId={setCandidateId}
            expert={expert}
            precomputed={precomputed}
          />
        )}
      </div>
    </main>
  );
}

function ExplorerHeader({ region, regions, regionId, setRegionId, refresh }: { region?: Region; regions: Region[]; regionId: string; setRegionId: (value: string) => void; refresh: () => Promise<void> }) {
  return (
    <div className="mb-5 flex flex-col gap-4 border-b border-[var(--line)] pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">01 / Living Sky Observatory</span>
          <span className="rounded-full border border-[var(--signal)]/30 bg-[var(--signal-soft)] px-2.5 py-1 mono text-[9px] uppercase tracking-[.12em] text-[var(--signal)]">DEMONSTRATION DATASET</span>
        </div>
        <h1 className="mt-3 text-3xl font-medium tracking-[-.055em] text-[var(--ink)] sm:text-4xl">Compare the sky across time.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Two registered observations, one evidence trail. Inspect what changed before you decide what it means.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2" title="Choose a provenance-backed field">
          <Database size={14} className="text-[var(--cyan)]" />
          <span className="mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">Field</span>
          <select value={regionId || region?.id || ''} onChange={(event) => setRegionId(event.target.value)} className="max-w-[210px] bg-transparent mono text-[10px] uppercase tracking-[.08em] text-[var(--ink)] outline-none" aria-label="Select sky field">
            {!regions.length && <option value="">No field loaded</option>}
            {regions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void refresh()} className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] px-3 py-2 mono text-[9px] uppercase tracking-[.12em] text-[var(--muted)] transition-colors hover:border-[var(--signal)] hover:text-[var(--signal)]" title="Refresh real API data"><RefreshCw size={13} /> Refresh</button>
      </div>
    </div>
  );
}

function ExplorerWorkspace({ region, candidates, records, images, candidateId, setCandidateId, expert, precomputed }: { region: Region; candidates: CandidateListItem[]; records: Record<string, CandidateRecord>; images: Partial<Record<keyof typeof ASSETS, PgmImage>>; candidateId: string; setCandidateId: (value: string) => void; expert: boolean; precomputed: boolean }) {
  const [mode, setMode] = useState<ComparisonMode>('blink');
  const [layer, setLayer] = useState<DifferenceLayer>('difference');
  const [epoch, setEpoch] = useState<EpochCode>('A');
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof BLINK_SPEEDS>('Normal');
  const [divider, setDivider] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [showOverlay, setShowOverlay] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const record = records[candidateId];

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (mode !== 'blink' || paused || reducedMotion) return;
    const timer = window.setInterval(() => setEpoch((current) => current === 'A' ? 'B' : 'A'), BLINK_SPEEDS[speed]);
    return () => window.clearInterval(timer);
  }, [mode, paused, reducedMotion, speed]);

  const toggleMode = (next: ComparisonMode) => {
    setMode(next);
    if (next === 'blink') setPaused(false);
  };
  const select = (id: string) => {
    setCandidateId(id);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className="min-w-0">
        {precomputed && <div className="mb-3 border border-[var(--amber)]/40 bg-[rgba(243,187,113,.08)] px-4 py-3 text-xs leading-5 text-[var(--amber)]" role="status">Read-only fallback: this field is rendered from the checked-in precomputed DEMONSTRATION DATASET. Live persistence and voting are unavailable until the API returns.</div>}
        <div className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] bg-[rgba(14,20,23,.72)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              {(['blink', 'split', 'difference'] as ComparisonMode[]).map((item) => (
                <button key={item} type="button" onClick={() => toggleMode(item)} className={`focus-ring rounded-full px-3 py-2 mono text-[9px] uppercase tracking-[.14em] transition-colors ${mode === item ? 'bg-[var(--signal)] text-[var(--void)]' : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'}`} title={`${item} comparison mode`}>
                  {item === 'split' ? <SquareSplitHorizontal size={12} className="mr-1.5 inline" /> : item === 'difference' ? <ScanSearch size={12} className="mr-1.5 inline" /> : <Play size={12} className="mr-1.5 inline" />}{item}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]"><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[var(--signal)] shadow-[0_0_8px_var(--signal)]" />{mode === 'blink' ? `Epoch ${epoch}` : mode === 'split' ? 'A / B linked' : layer}</span><span className="text-[var(--line-strong)]">·</span><span>{region.widthPixels} × {region.heightPixels} px</span></div>
          </div>
          <div key={`${candidateId}-${mode}-${layer}-${epoch}`} className="motion-safe:animate-[stepReveal_.36s_ease-out]"><SkyCanvas images={images} record={record} mode={mode} layer={layer} epoch={epoch} divider={divider} zoom={zoom} pan={pan} setPan={setPan} setZoom={setZoom} setDivider={setDivider} setMode={toggleMode} setPaused={setPaused} setEpoch={setEpoch} paused={paused} showOverlay={showOverlay} /></div>
          <ComparisonControls mode={mode} layer={layer} setLayer={setLayer} epoch={epoch} setEpoch={setEpoch} paused={paused} setPaused={setPaused} speed={speed} setSpeed={setSpeed} reducedMotion={reducedMotion} divider={divider} setDivider={setDivider} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]"><span className="inline-flex items-center gap-2"><Expand size={12} />Keyboard: arrows pan · +/- zoom · B/S/D modes · space pause blink</span><span className="inline-flex items-center gap-2"><Gauge size={12} className="text-[var(--signal)]" />Canvas render · {reducedMotion ? 'reduced motion on' : 'motion enabled'}</span></div>
      </section>
      <aside className="space-y-5">
        <CandidateQueue candidates={candidates} selectedId={candidateId} select={select} />
        <EvidencePanel record={record} expert={expert} showOverlay={showOverlay} setShowOverlay={setShowOverlay} />
        <FieldPanel region={region} provenance={record?.provenance} expert={expert} />
        {record?.spectrum && <SpectrumPanel spectrum={record.spectrum} />}
      </aside>
    </div>
  );
}

function SkyCanvas({ images, record, mode, layer, epoch, divider, zoom, pan, setPan, setZoom, setDivider, setMode, setPaused, setEpoch, paused, showOverlay }: { images: Partial<Record<keyof typeof ASSETS, PgmImage>>; record?: CandidateRecord; mode: ComparisonMode; layer: DifferenceLayer; epoch: EpochCode; divider: number; zoom: number; pan: Point; setPan: (value: Point | ((current: Point) => Point)) => void; setZoom: (value: number | ((current: number) => number)) => void; setDivider: (value: number) => void; setMode: (value: ComparisonMode) => void; setPaused: (value: boolean) => void; setEpoch: (value: EpochCode) => void; paused: boolean; showOverlay: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; pan: Point; divider: boolean } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const base = images.a;
    if (!canvas || !stage || !base) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const bounds = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = '#070b0d';
    context.fillRect(0, 0, width, height);
    const scale = Math.min(width - 36, height - 36) / base.width * zoom;
    const origin = { x: width / 2 - base.width * scale / 2 + pan.x, y: height / 2 - base.height * scale / 2 + pan.y };
    const makeCanvas = (image: PgmImage, difference: boolean) => {
      const buffer = document.createElement('canvas');
      buffer.width = image.width;
      buffer.height = image.height;
      const bufferContext = buffer.getContext('2d');
      if (!bufferContext) return buffer;
      const pixels = bufferContext.createImageData(image.width, image.height);
      image.pixels.forEach((value, index) => {
        const offset = index * 4;
        if (difference) {
          const signed = (value - 128) / 127;
          pixels.data[offset] = signed >= 0 ? 245 : 47;
          pixels.data[offset + 1] = signed >= 0 ? 129 : 176;
          pixels.data[offset + 2] = signed >= 0 ? 105 : 232;
          pixels.data[offset + 3] = Math.min(255, 55 + Math.abs(signed) * 230);
        } else {
          pixels.data[offset] = Math.min(255, value * .82);
          pixels.data[offset + 1] = Math.min(255, value * .97 + 10);
          pixels.data[offset + 2] = Math.min(255, value * .99 + 15);
          pixels.data[offset + 3] = 255;
        }
      });
      bufferContext.putImageData(pixels, 0, 0);
      return buffer;
    };
    const drawLayer = (image: PgmImage | undefined, difference: boolean, clip?: { left: number; right: number }) => {
      if (!image) return;
      context.save();
      if (clip) { context.beginPath(); context.rect(clip.left, 0, clip.right - clip.left, height); context.clip(); }
      context.imageSmoothingEnabled = zoom < 1.2;
      context.drawImage(makeCanvas(image, difference), origin.x, origin.y, image.width * scale, image.height * scale);
      context.restore();
    };
    if (mode === 'blink') drawLayer(epoch === 'A' ? images.a : images.b, false);
    if (mode === 'split') {
      const splitX = width * divider / 100;
      drawLayer(images.a, false, { left: 0, right: splitX });
      drawLayer(images.b, false, { left: splitX, right: width });
      context.fillStyle = 'rgba(200,255,107,.9)';
      context.fillRect(splitX - 1, 0, 2, height);
    }
    if (mode === 'difference') {
      const key = layer === 'original' ? (epoch === 'A' ? 'a' : 'b') : layer;
      drawLayer(images[key], layer === 'difference' || layer === 'residual');
    }
    context.strokeStyle = 'rgba(141,229,226,.14)';
    for (let tick = 1; tick < 8; tick += 1) {
      const x = origin.x + base.width * scale * tick / 8;
      const y = origin.y + base.height * scale * tick / 8;
      context.beginPath(); context.moveTo(x, origin.y); context.lineTo(x, origin.y + base.height * scale); context.stroke();
      context.beginPath(); context.moveTo(origin.x, y); context.lineTo(origin.x + base.width * scale, y); context.stroke();
    }
    context.strokeStyle = 'rgba(231,237,240,.22)';
    context.strokeRect(origin.x, origin.y, base.width * scale, base.height * scale);
    const point = (value: Point | null, color: string, name: string) => {
      if (!value) return;
      const x = origin.x + value.x * scale;
      const y = origin.y + value.y * scale;
      context.strokeStyle = color;
      context.fillStyle = 'rgba(8,11,13,.72)';
      context.lineWidth = 1.5;
      context.beginPath(); context.arc(x, y, 8, 0, Math.PI * 2); context.fill(); context.stroke();
      context.beginPath(); context.moveTo(x - 12, y); context.lineTo(x + 12, y); context.moveTo(x, y - 12); context.lineTo(x, y + 12); context.stroke();
      context.font = '10px DM Mono, monospace'; context.fillStyle = color; context.fillText(name, x + 15, y - 12);
    };
    const positionA = candidatePosition(record, 'A');
    const positionB = candidatePosition(record, 'B');
    if (showOverlay && mode === 'split') { point(positionA, '#c8ff6b', 'A'); point(positionB, '#8de5e2', 'B'); }
    else if (showOverlay) {
      point(epoch === 'B' ? positionB : positionA, epoch === 'B' ? '#8de5e2' : '#c8ff6b', record?.detail.candidateKey ?? 'candidate');
      if (positionA && positionB && record?.detail.classification === 'apparent_motion' && (mode === 'difference' || epoch === 'B')) {
        const ax = origin.x + positionA.x * scale; const ay = origin.y + positionA.y * scale;
        const bx = origin.x + positionB.x * scale; const by = origin.y + positionB.y * scale;
        context.strokeStyle = '#f3bb71'; context.lineWidth = 2; context.beginPath(); context.moveTo(ax, ay); context.lineTo(bx, by); context.stroke();
      }
    }
  }, [divider, epoch, images, layer, mode, pan, record, showOverlay, zoom]);

  useEffect(() => {
    draw();
    const observer = stageRef.current ? new ResizeObserver(draw) : null;
    if (stageRef.current && observer) observer.observe(stageRef.current);
    return () => observer?.disconnect();
  }, [draw]);

  const keyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(4, value + .25));
    if (event.key === '-') setZoom((value) => Math.max(.75, value - .25));
    if (event.key === 'ArrowLeft') setPan((value) => ({ ...value, x: value.x - 16 }));
    if (event.key === 'ArrowRight') setPan((value) => ({ ...value, x: value.x + 16 }));
    if (event.key === 'ArrowUp') setPan((value) => ({ ...value, y: value.y - 16 }));
    if (event.key === 'ArrowDown') setPan((value) => ({ ...value, y: value.y + 16 }));
    if (event.key.toLowerCase() === 'b') setMode('blink');
    if (event.key.toLowerCase() === 's') setMode('split');
    if (event.key.toLowerCase() === 'd') setMode('difference');
    if (event.key === ' ') { event.preventDefault(); setPaused(!paused); }
    if (event.key.toLowerCase() === 'a') setEpoch('A');
    if (event.key.toLowerCase() === 'e') setEpoch('B');
  };
  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width * 100;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan, divider: mode === 'split' && Math.abs(relativeX - divider) < 4 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.divider) {
      const rect = event.currentTarget.getBoundingClientRect();
      setDivider(Math.min(92, Math.max(8, (event.clientX - rect.left) / rect.width * 100)));
    } else {
      setPan({ x: current.pan.x + event.clientX - current.x, y: current.pan.y + event.clientY - current.y });
    }
  };
  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => { if (drag.current?.pointerId === event.pointerId) drag.current = null; };

  return (
    <div ref={stageRef} className="relative h-[min(68vh,720px)] min-h-[430px] overflow-hidden bg-[#070b0d]" onKeyDown={keyDown} tabIndex={0} aria-label="Interactive sky image. Use drag to pan and the controls to zoom.">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.min(4, Math.max(.75, value * (event.deltaY > 0 ? .9 : 1.1)))); }} role="img" aria-label="Rendered comparison of Epoch A and Epoch B sky observations" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(2,4,5,.6)_100%)]" />
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2"><span className="w-fit rounded-sm border border-[var(--line)] bg-[rgba(7,11,13,.74)] px-2 py-1 mono text-[9px] uppercase tracking-[.12em] text-[var(--muted)]">{mode === 'blink' ? `EPOCH ${epoch}` : mode === 'split' ? 'EPOCH A  /  EPOCH B' : layer.toUpperCase()}</span><span className="w-fit rounded-sm border border-[var(--line)] bg-[rgba(7,11,13,.62)] px-2 py-1 mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">PIXEL FRAME · NORTH ↑</span></div>
      {mode === 'split' && <div className="pointer-events-none absolute inset-y-0" style={{ left: `${divider}%` }}><div className="absolute -left-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-[var(--signal)] bg-[var(--void)] text-[var(--signal)]"><MousePointer2 size={13} /></div></div>}
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4"><div className="flex flex-wrap items-center gap-2 rounded-sm border border-[var(--line)] bg-[rgba(7,11,13,.75)] px-2.5 py-2 mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]"><Crosshair size={12} className="text-[var(--signal)]" /> {positionReadout(record)}</div><div className="pointer-events-auto flex items-center gap-1 rounded-sm border border-[var(--line)] bg-[rgba(7,11,13,.75)] px-2 py-1.5"><button type="button" onClick={() => setZoom((value) => Math.max(.75, value - .25))} className="focus-ring p-1 text-[var(--muted)] hover:text-[var(--signal)]" aria-label="Zoom out"><ZoomOut size={14} /></button><span className="min-w-[38px] text-center mono text-[9px] text-[var(--ink)]">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(4, value + .25))} className="focus-ring p-1 text-[var(--muted)] hover:text-[var(--signal)]" aria-label="Zoom in"><ZoomIn size={14} /></button></div></div>
    </div>
  );
}

function ComparisonControls({ mode, layer, setLayer, epoch, setEpoch, paused, setPaused, speed, setSpeed, reducedMotion, divider, setDivider }: { mode: ComparisonMode; layer: DifferenceLayer; setLayer: (value: DifferenceLayer) => void; epoch: EpochCode; setEpoch: (value: EpochCode) => void; paused: boolean; setPaused: (value: boolean) => void; speed: keyof typeof BLINK_SPEEDS; setSpeed: (value: keyof typeof BLINK_SPEEDS) => void; reducedMotion: boolean; divider: number; setDivider: (value: number) => void }) {
  return <div className="flex flex-col gap-3 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 sm:px-5">
    {mode === 'blink' && <div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-1 rounded-full border border-[var(--line)] p-1"><button type="button" onClick={() => setEpoch('A')} className={`focus-ring rounded-full px-3 py-1.5 mono text-[9px] ${epoch === 'A' ? 'bg-[var(--surface-2)] text-[var(--signal)]' : 'text-[var(--quiet)]'}`}>A</button><button type="button" onClick={() => setEpoch('B')} className={`focus-ring rounded-full px-3 py-1.5 mono text-[9px] ${epoch === 'B' ? 'bg-[var(--surface-2)] text-[var(--cyan)]' : 'text-[var(--quiet)]'}`}>B</button></div><button type="button" onClick={() => setPaused(!paused)} className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 mono text-[9px] uppercase tracking-[.1em] text-[var(--muted)] hover:text-[var(--ink)]">{paused || reducedMotion ? <Play size={12} /> : <Pause size={12} />}{reducedMotion ? 'Manual / reduced motion' : paused ? 'Resume' : 'Pause'}</button><div className="ml-auto flex items-center gap-1.5"><span className="mr-1 mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">Speed</span>{(Object.keys(BLINK_SPEEDS) as Array<keyof typeof BLINK_SPEEDS>).map((item) => <button key={item} type="button" onClick={() => setSpeed(item)} className={`focus-ring rounded-full px-2.5 py-1.5 mono text-[9px] ${speed === item ? 'bg-[var(--signal-soft)] text-[var(--signal)]' : 'text-[var(--quiet)] hover:text-[var(--ink)]'}`}>{item}</button>)}</div></div>}
    {mode === 'split' && <div className="flex flex-wrap items-center gap-3"><span className="mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">Comparison divider</span><input aria-label="Comparison divider position" type="range" min="8" max="92" value={divider} onChange={(event) => setDivider(Number(event.target.value))} className="h-1 min-w-[180px] flex-1 accent-[var(--signal)]" /><span className="mono text-[9px] text-[var(--signal)]">{divider}%</span><span className="mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">drag handle in view</span></div>}
    {mode === 'difference' && <div className="flex flex-wrap items-center gap-2"><span className="mr-2 mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">Layer</span>{(['original', 'registered', 'difference', 'residual'] as DifferenceLayer[]).map((item) => <button key={item} type="button" onClick={() => setLayer(item)} className={`focus-ring rounded-full px-3 py-1.5 mono text-[9px] uppercase tracking-[.1em] ${layer === item ? 'bg-[var(--signal-soft)] text-[var(--signal)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item}</button>)}<span className="ml-auto hidden items-center gap-2 text-[var(--quiet)] sm:inline-flex"><Info size={13} /> Difference = registered Epoch B − Epoch A</span></div>}
  </div>;
}

function CandidateQueue({ candidates, selectedId, select }: { candidates: CandidateListItem[]; selectedId: string; select: (id: string) => void }) {
  return <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><div><p className="eyebrow">Sky Mysteries</p><h2 className="mt-2 text-xl font-medium tracking-[-.04em] text-[var(--ink)]">Candidate queue</h2></div><span className="rounded-full border border-[var(--line)] px-2 py-1 mono text-[9px] text-[var(--quiet)]">{candidates.length.toString().padStart(2, '0')}</span></div><div className="divide-y divide-[var(--line)]">{candidates.map((candidate) => <button key={candidate.id} type="button" onClick={() => select(candidate.id)} className={`focus-ring block w-full px-5 py-4 text-left transition-colors ${selectedId === candidate.id ? 'bg-[var(--signal-soft)]' : 'hover:bg-[var(--surface-2)]'}`}><div className="flex items-start justify-between gap-3"><span className={`mono text-[10px] uppercase tracking-[.12em] ${selectedId === candidate.id ? 'text-[var(--signal)]' : 'text-[var(--ink)]'}`}>{candidate.candidateKey}</span><span className="rounded-full border border-[var(--line)] px-2 py-1 mono text-[8px] uppercase tracking-[.1em] text-[var(--quiet)]">{candidate.status}</span></div><p className="mt-2 text-xs capitalize text-[var(--muted)]">{label(candidate.classification)}</p><p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[var(--quiet)]">{candidate.interpretation}</p></button>)}</div></section>;
}

function positionReadout(record?: CandidateRecord) {
  const a = candidatePosition(record, 'A');
  const b = candidatePosition(record, 'B');
  if (!a && !b) return 'no candidate selected · drag to pan';
  const format = (point: Point | null) => point ? `[${numberText(point.x)}, ${numberText(point.y)}]` : '—';
  return `A ${format(a)} · B ${format(b)} · drag to pan`;
}

function EvidencePanel({ record, expert, showOverlay, setShowOverlay }: { record?: CandidateRecord; expert: boolean; showOverlay: boolean; setShowOverlay: (value: boolean) => void }) {
  if (!record) return <section className="panel p-5"><p className="eyebrow">Evidence panel</p><p className="mt-4 text-sm text-[var(--muted)]">Select a candidate to reveal its measurement record.</p></section>;
  const displacement = getArray(record.measurements, 'measurement.displacement_arcsec_xy');
  const deltaFlux = getNumber(record.measurements, 'measurement.delta_flux');
  const relativeChange = getNumber(record.measurements, 'measurement.relative_change');
  const shownMeasurements = record.measurements.filter((item) => item.value !== null).slice(0, expert ? 8 : 4);
  return <section className="panel overflow-hidden"><div className="border-b border-[var(--line)] px-5 py-4"><div className="flex items-center justify-between"><p className="eyebrow">Why was this flagged?</p><button type="button" onClick={() => setShowOverlay(!showOverlay)} className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[var(--signal)]/30 bg-[var(--signal-soft)] px-2 py-1 mono text-[8px] uppercase tracking-[.1em] text-[var(--signal)]"><Target size={11} /> {showOverlay ? 'Hide overlay' : 'Reveal overlay'}</button></div><h2 className="mt-2 text-xl font-medium tracking-[-.04em] text-[var(--ink)]">{record.detail.candidateKey}</h2><p className="mt-1 text-xs capitalize text-[var(--muted)]">{label(record.detail.classification)}</p></div><div className="space-y-5 p-5"><p className="text-sm leading-6 text-[var(--ink)]">{record.detail.interpretation}</p><div className="grid grid-cols-2 gap-2">{displacement && <Metric label="Displacement" value={`${numberText(displacement[0])}, ${numberText(displacement[1])}`} unit="arcsec" />}{deltaFlux !== null && <Metric label="Δ flux" value={numberText(deltaFlux)} unit="relative units" />}{relativeChange !== null && <Metric label="Relative change" value={`${numberText(relativeChange * 100, 1)}%`} unit="Epoch A → B" />}</div><div className="border-t border-[var(--line)] pt-4"><p className="mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">Stored measurements</p><div className="mt-3 space-y-2">{shownMeasurements.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 mono text-[10px]"><span className="truncate text-[var(--muted)]">{item.metricName.replace('.', ' / ')}</span><span className="shrink-0 text-[var(--ink)]">{numberText(item.value)} {item.unit ?? ''}</span></div>)}</div></div>{expert && <div className="border-t border-[var(--line)] pt-4"><p className="mono text-[9px] uppercase tracking-[.12em] text-[var(--quiet)]">Expert note</p><p className="mt-2 text-xs leading-5 text-[var(--muted)]">The overlay is positioned from the stored science-service measurement. Interpretation remains provisional and requires additional verification.</p></div>}</div></section>;
}

function Metric({ label: metricLabel, value, unit }: { label: string; value: string; unit: string }) {
  return <div className="rounded-sm border border-[var(--line)] bg-[var(--surface)] p-3"><p className="mono text-[8px] uppercase tracking-[.1em] text-[var(--quiet)]">{metricLabel}</p><p className="mt-2 text-sm text-[var(--ink)]">{value}</p><p className="mt-1 mono text-[8px] uppercase tracking-[.08em] text-[var(--quiet)]">{unit}</p></div>;
}

function FieldPanel({ region, provenance, expert }: { region: Region; provenance?: Provenance; expert: boolean }) {
  const epoch = objectValue(provenance?.epochA);
  const shape = Array.isArray(epoch.shape) ? epoch.shape.join(' × ') : `${region.widthPixels} × ${region.heightPixels}`;
  return <section className="panel p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Field metadata</p><h2 className="mt-2 text-lg font-medium tracking-[-.03em] text-[var(--ink)]">{region.name}</h2></div><span title="Metadata comes from the persisted observation."><CircleHelp size={16} className="text-[var(--quiet)]" /></span></div><div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4"><Meta name="Frame" value={String(epoch.coordinate_frame ?? '—')} /><Meta name="Shape" value={shape} /><Meta name="Pixel scale" value={epoch.pixel_scale_arcsec ? `${epoch.pixel_scale_arcsec} arcsec / px` : '—'} /><Meta name="Source" value={provenance?.sourceIdentifier ?? '—'} /></div>{expert && <div className="mt-5 border-t border-[var(--line)] pt-4"><div className="flex items-start gap-2"><LockKeyhole size={13} className="mt-0.5 shrink-0 text-[var(--cyan)]" /><div><p className="mono text-[9px] uppercase tracking-[.1em] text-[var(--cyan)]">Expert metadata</p><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{provenance?.algorithmVersion ?? '—'}</p><p className="mt-1 text-xs leading-5 text-[var(--quiet)]">{String(epoch.provenance_status ?? 'Provenance statement unavailable.')}</p></div></div></div>}</section>;
}

function Meta({ name, value }: { name: string; value: string }) {
  return <div><p className="mono text-[8px] uppercase tracking-[.1em] text-[var(--quiet)]">{name}</p><p className="mt-1 break-words text-xs leading-5 text-[var(--muted)]">{value}</p></div>;
}

function SpectrumPanel({ spectrum }: { spectrum: Spectrum }) {
  const max = Math.max(...spectrum.fluxEpochA, ...spectrum.fluxEpochB, 1);
  const points = (values: number[]) => values.map((value, index) => `${index / Math.max(values.length - 1, 1) * 100},${100 - value / max * 78 - 10}`).join(' ');
  return <section className="panel p-5"><div className="flex items-center justify-between"><div><p className="eyebrow">Spectral blink</p><h2 className="mt-2 text-lg font-medium tracking-[-.03em] text-[var(--ink)]">{spectrum.sourceId}</h2></div><span className="mono text-[9px] text-[var(--quiet)]">μm</span></div><svg viewBox="0 0 100 100" className="mt-4 h-24 w-full overflow-visible" role="img" aria-label={`Spectral comparison for ${spectrum.sourceId}`}><line x1="0" y1="90" x2="100" y2="90" stroke="rgba(199,218,224,.18)" /><polyline points={points(spectrum.fluxEpochA)} fill="none" stroke="#c8ff6b" strokeWidth="1.6" /><polyline points={points(spectrum.fluxEpochB)} fill="none" stroke="#8de5e2" strokeWidth="1.6" strokeDasharray="2 2" /></svg><div className="mt-3 flex gap-4 mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]"><span className="text-[var(--signal)]">— A</span><span className="text-[var(--cyan)]">- - B</span></div><p className="mt-3 text-[11px] leading-5 text-[var(--quiet)]">{spectrum.interpretation}</p></section>;
}

function LoadingState({ phase }: { phase: string }) {
  return <div className="panel relative grid min-h-[570px] place-items-center overflow-hidden"><div className="star-field opacity-70" /><div className="relative z-10 text-center"><div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full border border-[var(--signal)]/30 bg-[var(--signal-soft)] text-[var(--signal)]"><LoaderCircle className="motion-safe:animate-spin" size={25} /></div><p className="eyebrow">Observatory sequence</p><h2 className="mt-4 text-2xl font-medium tracking-[-.04em] text-[var(--ink)]" aria-live="polite">{phase}</h2><p className="mt-3 text-sm text-[var(--muted)]">Retrieving provenance-backed observations and measurements.</p><div className="mx-auto mt-6 h-px w-48 overflow-hidden bg-[var(--line)]"><div className="motion-safe:animate-[pulse_1.2s_ease-in-out_infinite] h-full w-1/3 bg-[var(--signal)]" /></div></div></div>;
}

function OfflineState({ error, offline, onStart, onRetry }: { error: string | null; offline: boolean; onStart: () => void; onRetry: () => void }) {
  return <div className="panel relative grid min-h-[570px] place-items-center overflow-hidden"><div className="star-field opacity-50" /><div className="relative z-10 max-w-md px-6 text-center"><div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full border border-[var(--amber)]/40 bg-[rgba(243,187,113,.08)] text-[var(--amber)]"><AlertTriangle size={24} /></div><p className="eyebrow text-[var(--amber)]">{offline ? 'Observatory offline' : 'No field selected'}</p><h2 className="mt-4 text-2xl font-medium tracking-[-.04em] text-[var(--ink)]">{error ? 'The comparison is waiting on its evidence.' : 'Initialize the demonstration field.'}</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{error ?? 'Load the explicitly labeled synthetic dataset through the API, then compare its two generated epochs here.'}</p><div className="mt-7 flex flex-wrap justify-center gap-3"><button type="button" onClick={onStart} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[var(--signal)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--void)]"><Sparkles size={14} /> Load demonstration field</button><button type="button" onClick={() => void onRetry()} className="focus-ring inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] px-4 py-3 mono text-[10px] uppercase tracking-[.12em] text-[var(--muted)] hover:text-[var(--ink)]"><RefreshCw size={14} /> Retry API</button></div><p className="mt-6 mono text-[9px] uppercase tracking-[.1em] text-[var(--quiet)]">No placeholder sky is shown while evidence is unavailable.</p></div></div>;
}
