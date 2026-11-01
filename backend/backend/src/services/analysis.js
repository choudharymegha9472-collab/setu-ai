// Pure analysis functions (no database) so they are easy to test.

const median = (arr) => {
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/** Robust z-score using median/MAD. Returns null if baseline is too small. */
export function robustZ(value, baseline) {
  if (!baseline || baseline.length < 20) return null;
  const med = median(baseline);
  const mad = median(baseline.map((v) => Math.abs(v - med)));
  // floor the spread so a very flat signal doesn't make tiny changes look huge
  const scale = Math.max(mad / 0.6745, 0.03 * Math.abs(med), 1e-6);
  return (value - med) / scale;
}

export const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };

export function worst(...levels) {
  const l = levels.filter(Boolean);
  return l.length ? l.reduce((a, b) => (SEVERITY_ORDER[b] > SEVERITY_ORDER[a] ? b : a)) : null;
}

/** Absolute bands loosely modelled on ISO 10816 velocity zones (mm/s RMS). */
export function severityFromVibration(rms, { warn, high, critical }) {
  if (rms >= critical) return "critical";
  if (rms >= high) return "high";
  if (rms >= warn) return "medium";
  return null;
}

export function severityFromZ(z) {
  if (z === null || z === undefined) return null;
  const a = Math.abs(z);
  if (a >= 8) return "critical";
  if (a >= 5) return "high";
  if (a >= 3.5) return "medium";
  return null;
}

// ---- waveform analysis ----
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = i + k + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

/** Features from a raw vibration waveform (e.g. accelerometer samples). */
export function waveformFeatures(samples, sampleRateHz) {
  if (!Array.isArray(samples) || samples.length < 8) throw new Error("Need at least 8 samples");
  if (!(sampleRateHz > 0)) throw new Error("sample_rate_hz must be > 0");
  const n0 = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / n0;
  const x = samples.map((v) => v - mean); // remove DC offset
  const rms = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / n0);
  const peak = x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
  const crest = rms > 0 ? peak / rms : 0;
  const kurtosis = rms > 0 ? x.reduce((a, v) => a + (v / rms) ** 4, 0) / n0 : 0; // ~3 healthy

  let n = 1;
  while (n < n0) n <<= 1;
  const re = new Array(n).fill(0), im = new Array(n).fill(0);
  for (let i = 0; i < n0; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n0 - 1))); // Hann
  fft(re, im);
  let best = 1, bestMag = -1;
  for (let k = 1; k < n / 2; k++) {
    const mag = Math.hypot(re[k], im[k]);
    if (mag > bestMag) { bestMag = mag; best = k; }
  }
  const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    rms: r(rms, 4), peak: r(peak, 4), crest_factor: r(crest, 3),
    kurtosis: r(kurtosis, 3), dominant_freq_hz: r((best * sampleRateHz) / n, 2),
  };
}
