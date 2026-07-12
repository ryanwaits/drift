import { ImageResponse } from 'next/og';
import { loadGoogleFont } from '@/lib/og-fonts';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  const serif = await loadGoogleFont('Instrument+Serif', 'd');

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1d1d1f',
      }}
    >
      <span
        style={{
          fontFamily: 'Instrument Serif',
          fontSize: 140,
          color: '#fbfaf6',
          transform: 'translateY(-6px)',
        }}
      >
        d
      </span>
    </div>,
    { ...size, fonts: [{ name: 'Instrument Serif', data: serif, style: 'normal', weight: 400 }] },
  );
}
