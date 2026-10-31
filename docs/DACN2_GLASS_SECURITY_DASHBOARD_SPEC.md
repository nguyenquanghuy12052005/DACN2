# DACN2 — Glass Security Command Center

> **Agent-ready UI/UX, animation and integration specification**  
> Status: DESIGN SPEC / NOT IMPLEMENTED  
> Target repository: `D:\DACN2` (Windows 11, PowerShell).  
> Primary language of product UI: English concise labels, optional Vietnamese descriptions.  
> Reference visual: user-supplied screenshot of a light, floating, translucent smart-home dashboard. Do not assume rights to copy its photography or proprietary assets.

## 0. Mission and operating rules

Implement a polished **glassmorphism control center** to demonstrate a defensive Layer-7 DDoS project. Provide:

1. **Client Demo Website**: real registration / login / simple requests routed through the existing Go Gateway to the NestJS API (use existing endpoints and contracts; never invent production behavior).
2. **Security Dashboard**: live metrics, traffic flow animation, gateway fingerprint/decision telemetry, AI traffic class, backend health and K3s pod state.
3. **Simulation Lab**: controlled traffic scenarios against **only locally owned/authorized isolated lab targets**, with enforced rate, concurrency, duration and emergency stop. No arbitrary user-entered external targets.

**Do not replace or rewrite the Go Gateway, NestJS, AI service, K3s, or existing contracts.** Inspect the repository and documentation first, reuse existing APIs, honor names defined in `docs/FEATURE_SPEC.md` and the telemetry contract, and record missing capabilities as TODO rather than faking them.

**Make an appealing UI that tells the real story accurately**: user/bot traffic enters Gateway; decisions become allowed/blocked/challenged as supported; only admitted requests reach upstream; global AI classification and per-client enforcement are different signals; backend pods scale based on admitted/legitimate load and configured policies, not raw attack rate.

## 1. Technology decision (chosen)

| Concern | Choice | Rationale |
|---|---|---|
| Web application | **React + Vite + TypeScript** | Independent frontend, straightforward integration with existing NestJS backend; avoid Next.js server complexity for demo |
| Styling | **Tailwind CSS** plus design tokens and a few custom glass CSS classes | Control transparency, responsive design, reusable styles |
| UI components | **shadcn/ui** or accessible headless components, selectively | Accessible dialogs, tabs, controls; avoid over-installation |
| Interactive system map | **@xyflow/react (React Flow)** | Node/edge topology, custom node widgets and edges, zoom/pan, optional fixed demo layout |
| Motion | **motion** (`motion/react`) and CSS transforms | Glass cards, page transitions, status pulses, micro-interactions |
| Traffic particles | **Custom SVG/Canvas overlay for topology**, not one React component per request | Aggregate high volume to bounded visual pulses; performance |
| Charts | **Apache ECharts** (via React wrapper or direct instance) | Streaming timeseries, line/stacked area, gauges; use a capped point buffer |
| Icons | **lucide-react** | Consistent thin-line iconography |
| Live updates | **SSE or WebSocket**, whichever backend supports; REST snapshot on initial load | Event-driven and reconnectable |
| Tests | Vitest + React Testing Library + Playwright smoke tests | State correctness, navigation, accessibility and demo reliability |

If repository already has an equivalent frontend or established dependency policy, **reconcile before installation**. Do not duplicate apps or install unreviewed packages. Use lockfile and pin compatible versions, validate licenses.

**Why not Bootstrap-first?** Bootstrap is fine for traditional admin panels, but the user's visual reference depends on custom transparency, spacing and responsive floating surfaces. React + Tailwind offers less friction for a fully bespoke design and sophisticated node/edge motion.

## 2. Reference GitHub projects and library links

Use as **references / selective reuse**, not wholesale copying:

- Glassmorphism admin UI, open-source Next.js components and theme controls (MIT, check current license): https://github.com/nesdesignco/Glassmorphism-Admin-Panel-UI
- Lightweight glass dashboard HTML/CSS prototype; useful for visual exploration (license not established: inspect before copying code): https://github.com/danielt69/glassmorphism-dashboard
- Bootstrap 5 option, if necessary: https://github.com/Muthamil-2306/supabase-database-with-ui
- React Flow: https://github.com/xyflow/xyflow and https://reactflow.dev/
- Motion: https://github.com/motiondivision/motion and https://motion.dev/docs/react
- Apache ECharts: https://github.com/apache/echarts and https://echarts.apache.org/
- shadcn/ui: https://ui.shadcn.com/
- Lucide: https://lucide.dev/

**No exact-source template was verified to match the supplied screenshot**, so create original layouts and visual assets. Do not depend on proprietary template markup, screenshot recreation, copied images, or license-unclear assets.

## 3. Visual direction: glassmorphism like the supplied image

### 3.1 Design language

- **Bright frosted-glass aesthetic**; translucent pearl / ivory / warm-gray cards; gentle peach/amber accents. A professional cybersecurity console with warm, premium visual language, **not a stereotypical black neon hacker dashboard**.
- Full-page visually rich but subdued background. Prefer original abstract gradients, soft architecture-like shapes, blurred texture; optional user-owned photo with darkening/contrast overlay. Dashboard must remain usable with a plain background.
- Main canvas: broad center glass slab with radius ~28–36 px; inner cards radius ~18–24 px; top toolbar and sidebar float separately.
- Floating **top bar**: product name, live connection status, environment label `LAB`, search/filter, light/dark selector, notifications.
- **Left floating icon rail**: Overview, Live Traffic, Clients, Threat Events, AI, Kubernetes, Simulation Lab, Settings.
- Optional right narrow contextual drawer: active scenario and last security events. Do not crowd the page.
- Use genuine blur only where visible and necessary. Cards over complex backgrounds need light translucent fill and a subtle opaque fallback to ensure legibility.
- Colors by semantic role: **teal/green** admitted, **coral/red** blocked, **amber** challenged/analyzing, **blue/indigo** informational, neutral gray unavailable. Color is never the sole channel (also icons, labels, patterns).
- Light theme is default and visually closest to reference; dark theme optional but supported.
- Fonts: Inter / Manrope / system fallback, stable numerals (tabular nums) for metrics.

### 3.2 Design tokens (initial values, adjust visually)

```css
:root {
  --glass-bg: rgba(255,255,255,.38);
  --glass-strong: rgba(255,255,255,.56);
  --glass-border: rgba(255,255,255,.48);
  --glass-blur: 18px;
  --radius-shell: 32px;
  --radius-card: 22px;
  --color-admitted: #168b75;
  --color-blocked: #d85451;
  --color-analyzing: #bf821f;
  --color-accent: #eea23f;
  --color-text: #22272b;
}
.glass-panel {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  backdrop-filter: blur(var(--glass-blur)) saturate(1.2);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.2);
  box-shadow: 0 14px 38px rgba(50,45,39,.09);
}
@supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
  .glass-panel { background: rgba(250,249,246,.95); }
}
```

These tokens are a starting point, not a pixel-exact commitment. Check WCAG-oriented text contrast in both themes; do not blur chart text.

### 3.3 Responsive strategy

- Desktop >= 1280 px: floating left rail + toolbar + multi-column cards; topology hero visible above fold.
- Tablet 768–1279 px: collapsed rail; responsive 2-column metrics; topology with horizontal pan if needed.
- Mobile < 768 px: single column, drawer navigation, simplified topology or summarized stages, accessible control sizes.
- Desktop presentation at 1920×1080 and 1366×768 is priority; test 390×844 mobile.

## 4. Information architecture

**Routes** (choose names consistent with existing frontend if one exists):

- `/demo`: **Client Demo**, normal website interactions using real Go Gateway route; registration, login or a simplified available endpoint. Only show claims grounded in real API responses.
- `/dashboard`: **Security Overview**, hero traffic-flow map, KPI strip, live timeseries, AI class, recent decisions, system health.
- `/dashboard/traffic`: detailed incoming / admitted / blocked RPS, backend latency, response status, error rate, connection trend.
- `/dashboard/clients`: anonymized client groups, JA4/H2 fingerprint summaries, suspicion scores if implemented; clearly show `not_collected` where unavailable.
- `/dashboard/events`: filterable gateway events; event timestamps, decision, reason codes, relevant fingerprints, trace IDs. Redact sensitive fields.
- `/dashboard/ai`: global 5-second window class (Normal / Flash Crowd / Pure L7 DDoS / Mixed Traffic), confidence only if real model provides it, feature availability and model status.
- `/dashboard/infrastructure`: K3s status, observed pod count, health, deployment readiness, autoscaling events, admitted RPS.
- `/dashboard/simulation`: scenario controller and safety indicators (LAB ONLY).
- `/dashboard/settings`: glass intensity, reduce motion, selected data source, streaming status, visualization density.

**First build only `/demo`, `/dashboard`, `/dashboard/simulation`** plus necessary shared components. Other pages can initially be small informative shells backed by available APIs, not invented functionality.

## 5. Hero visualization: animated request flow (signature feature)

### 5.1 Fixed logical topology

```text
   Human Users ──┐
                 ├──> Go Gateway ── ALLOWED ──> NestJS Service (K3s pods)
   Bot Traffic ──┘       │
                         ├── BLOCKED (terminal event)
                         └── Telemetry ──> AI Service ──> Insights / policy input*
                                                  │
                                   Autoscaling telemetry / K3s
```

`*` Display 'AI suggests' vs 'Gateway enforced' separately. Do not imply AI is necessarily synchronously on every request path. K3s does **not** inspect every request. The topology must distinguish **data plane** (solid lines) from **telemetry/control plane** (dashed lines).

### 5.2 Animation semantics

| Source signal | UI animation | Truthfulness rule |
|---|---|---|
| `request_received` or aggregate incoming bucket | Discrete dots/pulses travel Human/Bot → Gateway | The frontend **cannot reliably identify human vs bot from the request alone**; use verified client classification or label `unknown`. Display simulated labels only in simulation mode. |
| `allowed` | Green/teal pulses Gateway → upstream | Must represent an actual allowed/forwarded event or aggregate; not AI prediction alone. |
| `blocked` | Red/coral pulse stops at Gateway and fades near shield | Only after Gateway enforcement event; never animate toward NestJS. |
| `challenged` / `rate_limited` | Amber pulse branches to matching labeled outcome | Render only if supported in gateway contract. |
| AI classification changed | AI node transitions/pulses + labeled 5-second window result | Global traffic label is not a per-request decision. |
| K3s scaling / readiness | Pod chips visually add/remove after observed Kubernetes status changes | Do not fabricate scaling immediately when traffic spikes. |
| Backend/proxy error | Gateway → upstream link becomes caution-marked for affected events | Avoid showing every 5xx as blocked. |

**Critical**: The graphic is an **aggregate sampled visualization**, not a full per-packet network capture. Label it `Visualized sample of traffic` and base exact counters on server aggregates. Keep counts and animation independent.

### 5.3 Performance design

- Render no more than ~30–60 active moving pulses at once for desktop, reduce to <=15 on mobile; configure and benchmark actual budget.
- Convert incoming RPS to visual density using capped/saturating mapping such as `pulses/s = min(maxRate, k * sqrt(max(0, rps)))`. Avoid one animation per actual request.
- Update charts no faster than ~1 Hz by default; 5-second AI windows retain their own cadence. Transitions run via CSS transform/opacity or Canvas/SVG animation, not React re-render per frame.
- On high load, use aggregate streaks/flow lines rather than additional particles. Cap event log to ~200–500 rows client-side; charts to 5–15 min rolling window and decimate older points.
- Defer or pause offscreen animations; respect `prefers-reduced-motion`, offer explicit Pause Animation, display equivalent numeric/status information.
- Use React Flow mainly for nodes, labels and edges; use a **single controlled SVG/Canvas overlay** for particle effects. Avoid heavy custom edge animation per request.
- Clean up subscriptions, animation frames and reconnection attempts on unmount. Ensure no memory growth during >=15 min test.

### 5.4 Playback mode for presentation

Provide **three clearly labeled data modes**:

1. `LIVE`: real Gateway/AI/K3s data, streaming active.
2. `REPLAY`: recorded, anonymized lab event timeline with playback controls (play/pause/speed/scrub). No external live traffic.
3. `MOCK DESIGN`: synthetic fixture for early UI development, prominent `SIMULATED DATA` badge and distinct sample data source. **Never silently fall back to mock** when live connection fails.

On connection loss: show stale timestamp, degraded/disconnected state, freeze counters and disable assertions about real-time protection. Retry with exponential backoff. No fake ongoing attack animation.

## 6. Dashboard content / widgets

**Above the fold**:

1. **KPI cards**: Incoming RPS, Admitted RPS, Blocked RPS, Gateway p95 latency, Gateway health, K3s Ready pods. Display unit, 5-sec or 1-sec aggregation window, data freshness.
2. **Traffic Flow Map**: central hero (~40% width or full-width row), actual semantic phases and animated particle paths, legend and toolbar (`Pause motion`, `Show metrics`, `Source: Live/Replay/Mock`).
3. **AI Traffic Classification**: `Normal`, `Flash Crowd`, `Pure L7 DDoS`, `Mixed Traffic`, plus `Unavailable`/`Model not connected` state; last inference timestamp.
4. **Live Traffic Chart**: incoming vs admitted vs blocked RPS (and rate-limited if real), time axis, source indicator; never conflate requests with TCP connections.

**Below the fold**: events table, fingerprint summary (JA4 raw/original and Akamai H2 if present), per-client suspicion distribution if implemented, proxy errors/latency, K3s pod state and autoscaler decisions.

Metrics require accurate definitions. For a single same-window request accounting system: `incoming = admitted + blocked + other_terminal_actions + still_in_flight` may only balance if event definitions and counting boundary support it; do not force a fabricated identity. Prefer explicit definitions in contract.

## 7. Client Demo page

- Normal small realistic business UI (e.g., account signup) with name, email, password fields as appropriate to existing NestJS API.
- Submit goes to **Gateway URL**, never directly to the upstream NestJS URL in the browser (except explicitly separated dev diagnostics).
- Show safe success/failure messages and basic request details (HTTP status, correlation ID if available, server response time). Do not show secrets or password in telemetry.
- Provide multiple tabs only where real endpoints exist. If registration endpoints are absent, build `GET /health` or another safe non-mutating action first and mark signup TODO.
- Distinguish browser interaction from **load generator**. Browser does not spawn thousands of actual bots.

## 8. Simulation Lab / safety

Safe presets (all **authorized isolated lab only**):

- `NORMAL`: steady low-volume user flows.
- `FLASH_CROWD`: higher legitimate request rate with realistic pauses.
- `PURE_L7_DDOS_SIM`: controlled high-frequency synthetic traffic for detection/mitigation testing (do not expose arbitrary external targets).
- `MIXED`: legitimate + synthetic suspicious traffic concurrently to demonstrate legitimate availability.

Backend must enforce **target allowlist**, private/lab hostnames, authorization for starting tests, concurrency/RPS/duration ceilings, singleton scenario operation, logging and kill switch. Frontend settings are **not security controls**; enforce all limits server-side. Prefer k6/Locust test runner integrated by a supervised simulation controller; never let public visitors run the generator.

Controller UI: scenario preset, allowed target display, duration, bounded RPS/concurrency controls, Start/Stop, active timer, progress, output metrics. Use clear banners: `ISOLATED TEST ENVIRONMENT` and `Scenario source: synthetic/recorded/live`.

No live generation until security constraints, stop behavior, and capacity have been tested on the owned cluster. First UI iteration can use labeled fixtures.

## 9. Proposed telemetry adapter contract (illustrative only)

**Agent instruction**: these JSON shapes are **proposed UI adapter types, not verified backend contracts**. Do not implement or silently rename server fields until inspecting the actual API and `docs/FEATURE_SPEC.md`. Create `docs/DASHBOARD_DATA_MAPPING.md` with observed source → UI field mapping, sampling interval, units, missingness, privacy and provenance.

```ts
type SourceMode = 'live' | 'replay' | 'mock';
type DataStatus = 'ok' | 'stale' | 'unavailable' | 'incomplete';
type TrafficClass = 'normal' | 'flash_crowd' | 'pure_l7_ddos' | 'mixed' | 'unavailable';

type DashboardSnapshot = {
  time: string;               // ISO 8601 UTC timestamp
  source: SourceMode;
  status: DataStatus;
  windowSeconds: number;
  incomingRps?: number;
  admittedRps?: number;
  blockedRps?: number;
  gatewayLatencyP95Ms?: number;
  gatewayHealth?: 'healthy' | 'degraded' | 'down' | 'unknown';
  aiTrafficClass?: TrafficClass;
  aiWindowEnd?: string;
  readyPods?: number;
};

type SecurityEvent = {
  eventId: string;
  time: string;
  kind: 'request' | 'decision' | 'inference' | 'scale' | 'health' | 'proxy_error';
  decision?: 'allow' | 'block' | 'challenge' | 'rate_limit';
  reasonCode?: string;
  clientKey?: string;         // privacy-safe anonymized/stable-within-session identifier
  traceId?: string;
  source: SourceMode;
};
```

**Stream guidelines**:

- Initial REST snapshot followed by SSE/WebSocket deltas if available; use schema version and event ID / sequence for ordering and deduplication.
- Reconcile reconnect gaps from snapshot or documented replay cursor. Guard out-of-order events and monotonic counters (reset semantics).
- Do not leak cookies, authorization, request bodies, TLS keys, raw credentials or unnecessary IPs/paths in frontend events. Avoid logging full JA4 ClientHello, full HPACK header values.
- Gateway `health` (process liveness/readiness) must remain distinct from backend health and overall end-to-end availability.
- Keep samples and mocks in `src/mocks` with conspicuous provenance metadata.

## 10. Suggested repo/file structure

Use an existing frontend directory if the repository already defines one; otherwise propose (do not create duplicate without review):

```text
D:\DACN2\
  dashboard/                          # React/Vite/TypeScript app
    src/
      app/                             # routes, providers, composition
      pages/                           # demo, overview, simulation, etc.
      components/
        glass/                         # GlassPanel, FloatingNav, GlassStatCard
        topology/                      # TrafficFlowMap, CustomNodes, ParticleLayer
        charts/                        # TrafficSeries, LatencyChart
        events/                        # SecurityEventList
        simulation/                    # ScenarioControls
      features/
        telemetry/                     # adapter, hooks, streaming, data freshness
        replay/                        # playback engine + deterministic fixtures
        theme/                         # light/dark, blur intensity, reduced motion
      mocks/                           # explicitly marked mock fixtures
      styles/                          # tokens, global styles
      tests/
  docs/
    DASHBOARD_DESIGN_SPEC.md           # copy of this spec if adopting into repo
    DASHBOARD_DATA_MAPPING.md          # required observed API mapping
    DASHBOARD_PROGRESS.md              # persistent checkpoints
```

## 11. Implementation phases with gates (don't jump ahead)

### UI-00 — Repo inspection and architecture approval

- Inspect present frontend, Go Gateway, NestJS and observability contracts, agent rules and project milestones.
- Record actual available endpoints, telemetry channels, service status, any existing UX design, build tooling and design constraints.
- Confirm whether this dashboard is a new app, separate from the Client Demo app, or multiple routes in one frontend. **Default: one React project with two primary areas** for low resource cost.
- Output architecture note and data mapping gaps. Do not modify existing service code prematurely.
- **Gate:** compatible architecture and source paths documented.

### UI-01 — Design system + static screens

- Implement light-glass design tokens, floating rail/topbar, background, 6 KPI cards, static topology placeholder, status cards, sample chart, Client Demo shell and Simulation Lab shell.
- Responsive desktop/tablet/mobile; loading/empty/offline states; light/dark toggle and reduced motion.
- Use **clearly labeled mock fixtures**, no fake live counts.
- **Gate:** screenshots at 1920×1080, 1366×768, 390×844, contrast/accessibility review.

### UI-02 — Animated system topology

- Implement React Flow custom nodes + distinct data-plane/control-plane edges.
- Implement bounded moving particles / pulses, color-coded outcomes, throughput density cap, paused/reduced-motion mode, graceful fallback.
- Show labels and counts that remain correct even if animation paused.
- **Gate:** steady smooth rendering in representative load; bounded memory and DOM; deterministic demo playback.

### UI-03 — Data adapter and realtime integration

- Build typed transport adapter around verified Gateway/NestJS/AI/K3s telemetry endpoints.
- Implement snapshot + delta stream (or polling where justified), reconnect/backoff, stale indicator, event ordering/dedup, unit tests.
- Dashboard must show `Unavailable` when features not yet implemented.
- **Gate:** numbers match independently checked Gateway/AI/K3s samples within documented timing tolerance; no silent live→mock fallback.

### UI-04 — Safe scenario controller

- Add authorized test scenario orchestration using bounded server-side controller; verify target allowlist, max resource usage, Stop and cleanup.
- Separate actual live request sampling from simulated scenario labels.
- **Gate:** no remote/public target invocation; emergency stop verified; clients remain usable in mixed test.

### UI-05 — Presentation hardening

- Add replay mode using anonymized fixtures, deterministic timeline, export safe demo evidence, clear network status, and fallback graphics.
- Run unit/integration/e2e tests, security review, accessibility and performance smoke test (>=15 min live/replay).
- **Gate:** complete reproducible 5-minute demo script with logs/screenshots and no fabricated outcomes.

## 12. Acceptance criteria (definition of done)

- Glass appearance clearly references user screenshot: large frosted shell, floating toolbar, icon rail, rounded cards, subtle warm accents, legible graphs.
- `/demo` request traverses Gateway when endpoint exists; real status visible; sensitive form fields never logged.
- Live map visually distinguishes received, admitted, blocked, telemetry/AI and K3s scaling without confusing them.
- Aggregate chart and KPI values use verified data sources, with units, timestamp and clear missing/stale states.
- All animations respect reduced motion; 15 min load/replay does not leak handlers or unbounded nodes, particles, chart points.
- Simulation is lab-only, bounded and controllable; no unrestricted stress-test UI.
- Dark/light theme, mobile responsiveness and keyboard navigation work.
- `npm run build`, lint, unit tests and Playwright smoke pass (use repo's actual scripts if different).
- No unrelated gateway/business logic changes, no breaking existing HTTP/1.1 or HTTP/2 route.
- Agent documents evidence of each acceptance check, not just optimistic PASS claims.

## 13. Agent execution / checkpoint rules

1. **Read first**: repository tree, existing plans, `docs/FEATURE_SPEC.md`, telemetry specification, AI feature contract and existing progress log. Existing repository rules override assumptions in this proposal.
2. **Plan before edits**: list affected files, dependencies, data gaps, risks, and exact next safe task. Ask for approval only where necessary (significant dependency change, large rewrite, network downloads, unsafe/lab-run operations).
3. **Change in small tested increments**. Do not implement entire dashboard in one unverified pass. Maintain scope for current phase and report outcomes.
4. **Maintain progress after each task or before stopping/token exhaustion**: write current objective, files changed, commands and tests, result PASS/FAIL/BLOCKED, known defects, next concrete task, and how to resume to `docs/DASHBOARD_PROGRESS.md`. Preserve any existing global `PROGRESS.md`, `TASKS.md`, `DECISIONS.md` conventions.
5. **On resume**: read latest checkpoint, inspect working tree (`git status`, `git diff`), continue unfinished item; do not overwrite uncommitted user work.
6. **No silent invention**: if a server API, AI classifier, scaling policy, or security decision doesn't exist, show an explicit incomplete/UI placeholder and log dependency. Do not use mock data in Live mode.
7. **No unauthorized traffic generation**. Any load tests must be scoped to owned isolated endpoints and bounded by controller-side protections.
8. At each gate, report: completed items, file paths, verification commands, screenshots where available, blockers, and next phase proposal. Do not auto-run the next phase unless authorized by project workflow.

## 14. Initial agent prompt (copy/paste)

> Read `docs/DASHBOARD_DESIGN_SPEC.md` and current DACN2 project docs carefully. Start ONLY with **UI-00**: inspect the existing repo, Gateway/NestJS/AI/K3s telemetry interfaces and frontend structure; map real vs missing data; propose a compatible React/Vite/Tailwind architecture for the light glassmorphism dashboard and animated traffic flow. Do not change infrastructure, do not generate test attacks and do not silently invent APIs. Write `docs/DASHBOARD_DATA_MAPPING.md` and checkpoint per project conventions. Report findings, design risks, tests (if any), and the smallest next implementation step. Stop at the UI-00 gate for review.

## 15. 5-minute demo narrative (target, not current capability)

1. Open Client Demo; perform a successful signup/action via Gateway while dashboard is LIVE.
2. Observe Gateway receipt, admitted pulse and real request telemetry.
3. Trigger safe, bounded Flash Crowd in the isolated lab: traffic rises, AI classification changes if model ready, pods only change when K3s actually scales.
4. Trigger safe, bounded suspicious-traffic scenario: Gateway shows real block/rate-limit decisions; blocked pulses stop before backend.
5. Trigger Mixed: legitimate demo action remains responsive while suspect requests are filtered; demonstrate admitted vs raw RPS.
6. Stop scenario; observe measured recovery. If model or autoscaler absent, show `Unavailable`, switch to clearly marked REPLAY to narrate intended future behavior.

---

**Final product principle:** Make it gorgeous, responsive and alive, but never let the visuals claim an event the defensive system did not actually report.
