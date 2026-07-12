import { ImageResponse } from 'next/og';
import { loadGoogleFont } from '@/lib/og-fonts';

export const alt = "drift — code changes. docs don't. drift catches it.";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TAGLINE = "Code changes. Docs don't. Drift catches it.";
const DOMAIN = 'driftdev.sh';

const WAVES = [
  'M0 240 Q300 195 600 250 T1200 215',
  'M0 320 Q300 285 600 335 T1200 300',
  'M0 400 Q300 370 600 415 T1200 385',
];

export default async function Image() {
  const [serif, sans, mono] = await Promise.all([
    loadGoogleFont('Instrument+Serif', 'drift'),
    loadGoogleFont('Geist', TAGLINE),
    loadGoogleFont('Geist+Mono', DOMAIN),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fbfaf6',
        position: 'relative',
      }}
    >
      <svg
        aria-hidden="true"
        width="1200"
        height="630"
        viewBox="0 0 1200 630"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {WAVES.map((d) => (
          <path key={d} d={d} stroke="rgba(29,29,31,0.08)" strokeWidth="2" fill="none" />
        ))}
      </svg>
      <div style={{ fontFamily: 'Instrument Serif', fontSize: 200, color: '#1d1d1f' }}>drift</div>
      <div
        style={{
          fontFamily: 'Geist',
          fontSize: 30,
          color: 'rgba(29,29,31,0.65)',
          marginTop: 20,
        }}
      >
        {TAGLINE}
      </div>
      <div
        style={{
          fontFamily: 'Geist Mono',
          fontSize: 20,
          color: 'rgba(29,29,31,0.45)',
          marginTop: 44,
          letterSpacing: 1,
        }}
      >
        {DOMAIN}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Instrument Serif', data: serif, style: 'normal', weight: 400 },
        { name: 'Geist', data: sans, style: 'normal', weight: 400 },
        { name: 'Geist Mono', data: mono, style: 'normal', weight: 400 },
      ],
    },
  );
}
