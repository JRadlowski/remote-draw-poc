# Remote Draw Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time web prototype for remote technical support with drawing and freeze-frame features.

**Architecture:** Two-folder project (server/client). Node.js backend for LiveKit tokens, React frontend for Expert/Client roles. Real-time sync via LiveKit Data Channels.

**Tech Stack:** React (TS), Vite, Node.js (Express), LiveKit SDK.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`
- Create: `client/` (via Vite)

- [ ] **Step 1: Initialize Server**
Run `npm init -y` in `server/`. Install `express`, `cors`, `dotenv`, `livekit-server-sdk`. Add `tsx` and `typescript` as dev dependencies.

- [ ] **Step 2: Initialize Client**
Run `npm create vite@latest client -- --template react-ts`. Install `livekit-client`, `livekit-react`.

- [ ] **Step 3: Configure TypeScript**
Ensure `tsconfig.json` in both folders is set up for TS development.

---

### Task 2: Token Generation Endpoint

**Files:**
- Create: `server/src/index.ts`
- Create: `server/.env`

- [ ] **Step 1: Write Token Service**
Implement `/api/session` to generate unique room names and tokens for 'expert' and 'client'.

- [ ] **Step 2: Verify Token Endpoint**
Start server and test with `curl`.

---

### Task 3: Core RTC Connection

**Files:**
- Create: `client/src/components/LiveKitRoom.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Implement LiveKit Connection**
Expert joins as listener, Client joins as publisher (rear camera).

---

### Task 4: Real-time Drawing Sync

**Files:**
- Create: `client/src/components/DrawingCanvas.tsx`
- Create: `client/src/types/protocol.ts`

- [ ] **Step 1: Implement Drawing**
Expert emits coordinates via Data Channels. Client renders received points on a canvas overlay.

---

### Task 5: Freeze-Frame Feature

**Files:**
- Create: `client/src/components/FreezeManager.tsx`

- [ ] **Step 1: Implement Freeze**
Expert sends 'FREEZE' command. Both sides capture current video frame to canvas overlay.
