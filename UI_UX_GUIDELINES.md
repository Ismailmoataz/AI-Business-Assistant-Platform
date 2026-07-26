# UI/UX Guidelines

## Current product surface

The Next.js frontend is branded **Orbit** while the repository/backend retain the AI Business Assistant Platform name. Implemented pages include authentication, `/dashboard`, and protected `/assistant`, `/documents`, `/projects`, `/tasks`, `/employees`, `/customers`, `/notes`, and `/tags` workspaces with business detail routes; `/` redirects to the dashboard.

The executive dashboard is the post-login landing experience. It presents the authenticated company, current local date/time, a daily AI brief with an explicit live-data fallback, nine real KPI cards, role-aware quick actions, and modular My Work, Projects, Documents, AI, Customers, Employees, and paginated Activity widgets. Widget ordering, collapsed state, and balanced/compact layout preference persist in the shared UI store. The dashboard reuses the top-bar command search and its `Ctrl/Command+K` shortcut rather than implementing another search surface.

The Documents Workspace keeps nested folder navigation persistent on desktop and places it in a dismissible overlay on smaller screens. Its toolbar preserves active folder and filters while changing views, upload progress remains visible without blocking browsing, processing documents poll until ready or failed, and the optional details panel overlays narrow layouts.

The Projects and Tasks workspaces preserve backend filter/sort state while switching among project grid/table and task list/Kanban/table views. Desktop data tables may scroll inside their own bounded container; mobile uses stacked cards, and the Kanban board reflows from one to four columns without page-level horizontal overflow. Drag-and-drop is complemented by labelled native status controls for keyboard and touch access.

Employee and Customer directories use paginated grid/table views with mobile cards. Notes render user-authored Markdown with raw HTML disabled. Tags expose usage by entity type. The top-bar command search opens with `Ctrl/Command+K`, debounces backend requests, groups results by resource, and preserves partial results when a role cannot access one group.

## Design system

Global semantic tokens live in `frontend/app/globals.css`. Use token-backed utilities (`background`, `foreground`, `card`, `primary`, `muted`, `accent`, `destructive`, `success`, `warning`, `border`, `ring`) instead of introducing isolated colors, except intentional brand/illustration accents. The system provides light and dark palettes, a 0.75rem base radius, card shadows, and system-first typography.

Reusable primitives are in `frontend/components/ui`: avatar, badge, button, card, dialog, empty/error states, file card, filters, input/label, pagination, search, skeleton, table, tabs, toaster, and an AI bubble. Extend these components through `className` and the `cn` helper before creating near-duplicates.

## Layout and responsiveness

- Authentication uses a focused form column and a large-screen marketing panel; the panel is hidden on smaller screens.
- Dashboard content lives inside `AppShell` with persistent desktop sidebar, mobile navigation state, breadcrumbs, top bar, and theme control.
- The AI Workspace fills the available application height. Conversation history is persistent on desktop and opens as a focus-managed drawer on tablet/mobile; the composer remains reachable below the scrollable message timeline.
- Use responsive grids, bounded content widths, and horizontal overflow inside desktop data-table containers only; the application page itself must not overflow horizontally.
- Keep primary actions visible, destructive actions visually distinct, and icon-only controls labeled with `aria-label`.

## Interaction states

Every data surface should define loading, empty, error/retry, success, disabled, and permission-denied behavior. Existing conventions are skeletons for loading, `EmptyState`, `ErrorState`, button spinners, and Sonner toasts. TanStack Query defaults to 30-second stale time, one retry, and no refetch on window focus.

Authentication forms use React Hook Form with Zod, field-level errors, appropriate autocomplete values, disabled submit buttons, and generic server error toasts. Preserve the refresh-client behavior: a 401 may trigger one coalesced refresh and one request retry, after which the session clears.

## Accessibility

- Preserve visible keyboard focus rings and semantic elements.
- Associate labels with controls through explicit `htmlFor`/`id` pairs.
- Use `role="alert"` for validation/error summaries and accessible names for icon-only controls.
- Ensure dialogs keep Radix focus management and provide titles/descriptions.
- Keep text/background contrast across both themes and do not rely on color alone.
- Respect the global `prefers-reduced-motion` rule and avoid essential information conveyed only through animation/hover.
- Extend the Playwright keyboard, responsive-overflow, and axe checks when changing a critical surface; do not suppress serious/critical violations without a documented product decision.

## Content and data integrity

Use concise, plain-language actions and keep terminology aligned with backend resources. Never display data from another tenant or infer authorization in the browser; backend enforcement is authoritative. Do not describe AI output as verified fact. The AI Workspace distinguishes user and generated content, streams pending output visibly, preserves provider errors as recoverable states, and labels AI output as potentially inaccurate. Conversation search is debounced and server-backed. Assistant responses show an expandable citation section; opening a source must use an authenticated document endpoint so current tenant and visibility rules remain authoritative, while responses without retrieval results state that no citations are available.

The dashboard never substitutes sample values for live records. It uses explicit skeleton, error/retry, empty, restricted, AI-generated, and AI-fallback states. Customer counts and customer widgets identify employee-role restrictions, while company activity identifies its manager/administrator requirement instead of appearing as an empty successful result.

## Frontend integration rules

- Add API functions under `frontend/lib/api` and domain types under `frontend/lib/types`.
- Do not call backend URLs directly from components.
- Keep browser-safe values only in `NEXT_PUBLIC_*`; secrets must never enter the frontend bundle.
- Validate against the backend contract. The current frontend password minimum (8) is weaker than the backend configurable minimum (default 12); align it before expanding authentication flows. The shared `Activity` type now follows the backend response and must remain synchronized.
- Add route-level authorization/redirect behavior when protected pages are implemented; persisted local tokens alone are not proof of a valid session.
