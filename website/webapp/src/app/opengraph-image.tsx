import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';
export const alt = 'ALIGN Sports — Team management for recreational and youth sports';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
  const logoBuffer = await readFile(join(process.cwd(), 'public/align-logo.png'));
  const logoSrc = `data:image/png;base64,${logoBuffer.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#080c14',
          fontFamily: 'system-ui, sans-serif',
          color: '#f1f5f9',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -300,
            left: -200,
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(103,232,249,0.22) 0%, rgba(103,232,249,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -300,
            right: -200,
            width: 900,
            height: 900,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167,139,250,0.22) 0%, rgba(167,139,250,0) 70%)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, zIndex: 1 }}>
          <img src={logoSrc} width={72} height={72} style={{ borderRadius: 16 }} />
          <div
            style={{
              fontSize: 40,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              backgroundImage: 'linear-gradient(135deg, #67e8f9 0%, #a78bfa 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              display: 'flex',
            }}
          >
            ALIGN Sports
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, zIndex: 1 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 104,
              fontWeight: 900,
              letterSpacing: '-0.04em',
              lineHeight: 1.02,
            }}
          >
            <div style={{ display: 'flex' }}>Your team.</div>
            <div
              style={{
                display: 'flex',
                backgroundImage: 'linear-gradient(135deg, #67e8f9 0%, #a78bfa 100%)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Finally organized.
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              color: '#94a3b8',
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            Free team management for recreational sports — schedules, rosters, lineups, payments, chat, and stats in one app.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            {['Hockey', 'Baseball', 'Basketball', 'Soccer', 'Lacrosse'].map((s) => (
              <div
                key={s}
                style={{
                  display: 'flex',
                  padding: '10px 18px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontSize: 20,
                  color: '#cbd5e1',
                  fontWeight: 500,
                }}
              >
                {s}
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 26px',
              borderRadius: 999,
              backgroundImage: 'linear-gradient(135deg, #67e8f9 0%, #a78bfa 100%)',
              color: '#0b1220',
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.01em',
            }}
          >
            Download free on iOS →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
