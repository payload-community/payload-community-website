import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'

/** Default social preview image (1200×630) with the portal's text wordmark. */
export function GET() {
  return new ImageResponse(
    <div
      style={{
        background: '#0c0c0c',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        padding: '80px',
        width: '100%',
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: '-2px' }}>Payload CMS</div>
      <div style={{ color: '#a3a3a3', fontSize: 44, letterSpacing: '8px', marginTop: 12 }}>
        COMMUNITY PORTAL
      </div>
    </div>,
    { height: 630, width: 1200 },
  )
}
