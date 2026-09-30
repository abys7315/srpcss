import { useTheme, type UnitSystem } from '../context/ThemeContext';

/** Unit conversion for display. Backend values arrive in the units named by each function. */
export const BBL_PER_M3 = 6.2898;

type Q = { value: number; unit: string };

export const conv = {
  rateFromBpd: (bpd: number, u: UnitSystem): Q =>
    u === 'metric' ? { value: bpd / BBL_PER_M3, unit: 'm³/d' } : { value: bpd, unit: 'bbl/d' },
  volFromBbl: (bbl: number, u: UnitSystem): Q =>
    u === 'metric' ? { value: bbl / BBL_PER_M3, unit: 'm³' } : { value: bbl, unit: 'bbl' },
  pressFromBar: (bar: number, u: UnitSystem): Q =>
    u === 'metric' ? { value: bar, unit: 'bar' } : { value: bar * 14.5038, unit: 'psi' },
  tempFromC: (c: number, u: UnitSystem): Q =>
    u === 'metric' ? { value: c, unit: '°C' } : { value: c * 1.8 + 32, unit: '°F' },
  lenFromM: (m: number, u: UnitSystem): Q =>
    u === 'metric' ? { value: m, unit: 'm' } : { value: m * 3.28084, unit: 'ft' },
  loadFromLbf: (lbf: number, u: UnitSystem): Q =>
    u === 'metric' ? { value: lbf * 0.0044482, unit: 'kN' } : { value: lbf, unit: 'lbf' },
};

export const fmt = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function useUnits() {
  const { units } = useTheme();
  return { units, ...Object.fromEntries(Object.entries(conv).map(([k, f]) => [k, (x: number) => f(x, units)])) } as {
    units: UnitSystem;
  } & { [K in keyof typeof conv]: (x: number) => Q };
}
