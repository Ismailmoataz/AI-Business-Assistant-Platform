# Orbit frontend

Phase 5 establishes a production-grade Next.js App Router foundation with an executive dashboard plus AI, Documents, Projects, Tasks, Employees, Customers, Notes, and Tags workspaces for the AI Business Assistant Platform.

## Architecture

- `app/` — route groups for public authentication and the authenticated application shell.
- `components/ui/` — reusable shadcn-style primitives and shared states.
- `components/shell/` — responsive navigation, workspace switcher, breadcrumbs, and account controls.
- Feature folders under `components/` compose AI, documents, projects, tasks, employees, customers, notes, tags, and command search from shared UI and business primitives.
- `lib/api/` — typed backend client with bearer authorization and refresh-token rotation.
- `lib/validations/` — Zod contracts aligned to backend validation.
- `stores/` — narrow persisted Zustand stores for session and interface preferences.

Browser quality infrastructure lives in `e2e/`; it contains isolated Playwright fixtures, seeded synthetic API contracts, page helpers, and critical journeys. `playwright.config.ts` defines parallel desktop coverage, cross-browser smoke projects, mobile coverage, artifacts, and local servers.

## Design system

The executive dashboard uses one bounded backend overview query for authorized company context, KPIs including notes, storage, AI brief, work, document, project, conversation, customer, and employee data. It reuses the paginated activity contract and global command search, exposes role-aware navigation shortcuts without duplicating workspace forms, lazy-loads the activity widget, and persists balanced/compact density, widget order, and collapse state without storing business data in UI preferences.

Semantic CSS variables define light and dark palettes for backgrounds, cards, text, borders, inputs, focus rings, status colors, and the indigo brand accent. Tailwind utilities use a 4px spacing rhythm, Geist typography, radii from 8–16px, restrained layered shadows, 150–200ms transitions, reduced-motion support, and Lucide icons.

Shared UI includes buttons, cards, inputs, labels, badges, avatars, tables, dialogs/modals, tabs, pagination, filter bars, search, file cards, AI chat bubbles, skeletons, empty states, error states, and Sonner toasts. The dialog primitive also provides the accessible foundation for future drawers.

## Backend integration

Set `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`). All product workspaces use the typed FastAPI clients and the same refresh-aware authorization path. Business directories use paginated backend search/filter/sort; profiles resolve linked work, notes, documents, tags, and exact-entity activity; customer, note, and tag mutations remain role-aware; and command search queries authorized endpoints without weakening server enforcement. API data remains company-isolated because tenant identity is derived exclusively from backend-validated JWT claims.

Rich assistant output uses `react-markdown`, `remark-gfm`, and `rehype-highlight`; the renderer is loaded as a separate client chunk. Raw HTML remains disabled.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npx playwright install chromium firefox webkit
npm run e2e
npm run e2e:debug
```

The dashboard displays only authenticated live data. Loading, backend errors, empty collections, permission restrictions, and AI fallback are explicit states and never substitute sample business values.

Browser tests seed and clean a unique synthetic workspace per test, use semantic selectors and API/lifecycle synchronization, and retain traces, screenshots, and videos for failures. See the root `TESTING.md` for coverage, production-build mode, CI, and debugging instructions.
