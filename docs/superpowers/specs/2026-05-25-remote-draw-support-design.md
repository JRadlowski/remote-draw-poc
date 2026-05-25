# Design Spec: Remote Draw Support PoC (2026-05-25)

## 1. Objective
Build a real-time web prototype for remote technical support.
- **Client (Mobile):** Streams rear camera, sees drawings on screen, talks to expert.
- **Expert (Desktop):** Views stream, draws on image, toggles "Freeze-Frame" to draw on a static image.
- **Constraint:** No app installation for client. High real-time performance (<100ms drawing sync).

## 2. Architecture
Two-folder project structure:
- `/server`: Node.js/Express (TypeScript)
- `/client`: React (TypeScript/Vite)

### Infrastructure
- **LiveKit Cloud:** Used for RTC (Video, Audio, Data Channels).
- **Communication:**
  - One-way Video (Client -> Expert)
  - Two-way Audio
  - Data Channels (Drawing sync, control signals)

## 3. Detailed Components

### Server (Backend)
- `POST /api/session`: 
  - Generates a unique `roomName`.
  - Creates two LiveKit tokens: `expert_token` and `client_token`.
  - Returns tokens and room name.

### Client (Frontend - React)
#### Components
- `App.tsx`: Routing/Entry (Join as Expert or Join as Client).
- `Room.tsx`: Main LiveKit session component.
- `VideoPlayer.tsx`: Renders the incoming or outgoing stream.
- `DrawingCanvas.tsx`: 
  - Overlays video.
  - Expert: Mouse events -> `DRAW_POINT` data packets.
  - Client: Data events -> Render lines.
  - Coordinates normalized to 0.0-1.0 (X, Y) for cross-device consistency.
- `FreezeManager.tsx`: 
  - Captures `<video>` frame to `<canvas>` on "Freeze" command.
  - Displays static canvas over video.

#### State Management
- `isFrozen`: Boolean.
- `currentStroke`: Active line being drawn.
- `allStrokes`: History of lines on canvas.

## 4. Data Protocol (JSON via Data Channels)
- `DRAW_POINT`: `{ type: 'DRAW_POINT', x: number, y: number, isNew: boolean, color: string }`
- `CLEAR`: `{ type: 'CLEAR' }`
- `FREEZE`: `{ type: 'FREEZE', active: boolean }`

## 5. Success Criteria
- Latency < 300ms for video/audio.
- Drawing sync < 100ms.
- Works on mobile Safari/Chrome without installation.
