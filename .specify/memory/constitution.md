<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Added principles: Android-first, daily-flow reliability, coherent design system,
  purposeful motion, local-first data safety, evidence-based completion
- Added sections: Product constraints, delivery gates
- Templates reviewed: plan-template.md, spec-template.md, tasks-template.md
- Follow-up TODOs: none
-->

# LIFEOS Constitution

## Core Principles

### I. Android-First Interaction

LIFEOS MUST behave like a native Android product. Every interactive target MUST be
at least 48 dp, system Back MUST work, status/navigation/keyboard insets MUST be
respected, and primary navigation MUST remain usable on compact screens. Web-only
patterns MUST NOT be introduced into the mobile runtime.

### II. The Daily Flow Is the Product

The Today timeline, calendar, task pool, habits, routines, notes, metrics, and
settings MUST feel like one connected operating system. Visual changes MUST
improve planning, scanning, acting, or understanding. Decorative complexity that
slows repeated daily actions MUST be removed.

### III. One Coherent Design System

Color, typography, spacing, shape, iconography, elevation, states, and motion MUST
come from shared semantic tokens and primitives. Screens MUST NOT invent local
button, input, card, sheet, or header vocabularies when a shared component exists.
The user-selected accent color MUST remain supported with accessible foregrounds.

### IV. Purposeful and Accessible Motion

Motion MUST communicate feedback, hierarchy, or state change. Frequent actions
MUST feel immediate; ordinary transitions SHOULD complete in 150-250 ms. Motion
MUST use transform/opacity where possible and MUST honor the Android remove-
animations preference with a reduced or instant alternative.

### V. Local-First Data Safety

UI work MUST preserve persisted task, routine, note, habit, timeline, execution,
and settings formats unless an explicit migration is designed and tested. Visual
state MUST NOT silently mutate completion, scheduling, XP, or history semantics.

### VI. Evidence Before Completion

No screen or flow is complete from code inspection alone. Type checking and unit
tests MUST pass. Every changed primary flow MUST be exercised on Android at the
relevant compact viewport, and modal, keyboard, empty, error, overflow, and long-
content states MUST be inspected where applicable.

## Product Constraints

- Runtime: Expo and React Native, targeting Android first.
- Architecture: local TypeScript scheduler and Zustand store remain authoritative.
- Navigation: compact phones use no more than five persistent bottom destinations.
- Accessibility: text and controls MUST meet WCAG AA contrast equivalents; important
  state MUST not rely on color alone.
- Visual identity: graphite neutral surfaces, user-selected accent, restrained
  semantic colors, compact Material 3-inspired density.
- Dependencies: reuse Expo, Reanimated, gesture-handler, safe-area-context, and the
  existing Lucide icon family before adding libraries.

## Delivery Gates

Every UI delivery MUST include:

1. A requirement-to-screen inventory that proves all in-scope routes and overlays.
2. Shared primitives before broad screen-specific styling.
3. Android-safe keyboard and system inset behavior for every input flow.
4. `npm run typecheck`, `npm test`, and `git diff --check` passing.
5. Android screenshots or emulator/device evidence for primary flows.
6. Documentation updated to distinguish completed work from remaining release risk.

## Governance

This constitution supersedes ad hoc visual preferences. Amendments require a
documented rationale, a semantic version bump, and a review of active Spec Kit
artifacts. Every implementation plan and completion review MUST check these
principles. Exceptions MUST be explicit, temporary, and recorded in the plan.

**Version**: 1.0.0 | **Ratified**: 2026-07-20 | **Last Amended**: 2026-07-20
