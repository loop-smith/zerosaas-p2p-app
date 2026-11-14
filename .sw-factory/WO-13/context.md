<!--lint disable strong-marker-->

# Work Order Entity Index: WO-13

**Initialized At (UTC):** 2026-11-14T05:55Z
**Current Status:** in_review (built in this fence; Software Factory status unchanged from this seat)

## Work Order

- SF WO-13: Implement ZeroSaaS P2P White Enterprise Workbench & Brand Redesign (`97cb2858-1488-4b34-829c-b0162ea65be3`). Priority Urgent. Planner status In Progress when the build row was lit.
- Source: Validator Feedback `FB-3` ➔ Theme `THM-2`.
- Build row: `HARA WO-13`, fenced to `public/`, `tests/`, `README.md`, `docs/software-factory-trace.md` and `.sw-factory/WO-13/`.

## Validator Round-Trip

| Record | UUID | Content | Status |
| --- | --- | --- | --- |
| Feedback `FB-3` | `0ce52256-27a7-4167-b1ea-ea9628ad7a00` | Product owner UX change order. The dark "Copper Command Desk" from `WO-04-A` is rejected on look and name; the app is ZeroSaaS P2P. | Built by `HARA WO-13`; awaiting Qualify Review |
| Theme `THM-2` | `d3ab7474-57fa-40f0-9876-c0099c863806` | ZeroSaaS P2P White Enterprise Workbench & Brand Change Order (Urgent). Groups `FB-3`. | Open |

## Requirements

- Foundry Requirement `REQ-01` (`1fc08c46-ed36-4a14-99a3-0eae8de04206`), extended with `REQ-P2P-012`..`REQ-P2P-020`. The Work Order acceptance text cites them by screen region:
  - `REQ-P2P-012` — Branded Light Enterprise Workbench: palette, `ZeroSaaS P2P` brand and title, zero legacy desk naming, 100vh shell, 48px topbar and 3-column grid.
  - Topbar — `REQ-P2P-012`, `015`, `017`, `018`, `019`.
  - Left rail — `REQ-P2P-013`, `016`.
  - Center stage — `REQ-P2P-013`, `014`, `015`.
  - Right rail — `REQ-P2P-015`, `016`, `020`.
- Only `REQ-P2P-012` is named in the acceptance text. The other requirement bodies were not read; see Referenced Blueprints.

## Blueprints

- Foundry Architecture Blueprint `BP-01` (`61e1a72e-d90f-4d32-a3b6-a4b002ed4d2d`), updated with `ADR-006`: 48px white topbar + `236px | minmax(0, 1fr) | 392px` grid in a 100vh zero-scroll shell at the 1440×900 boundary.
- Foundry Feature Blueprint (`bf2a43c7-eea6-4ea6-839a-6d83ae12b8a8`).

## Referenced Blueprints

Blueprints reached through `@…` mentions and links while reading linked blueprints.

- None discovered. The Software Factory MCP is not exposed in this seat, so the `REQ-01`, `BP-01` and `ADR-006` bodies were not read. Scope came from the Work Order acceptance text delivered with the build row.

## Delivery

- Branch: the launcher commits the in-fence diff. This seat does not commit, push or write a receipt.
- Pull Request URL: none

## Live 8090 Software Factory Traceability

- **Organization:** `Robert Paddock — EVOLVE Hackathon` (`ab209dd1-ce3e-4eda-9839-f5982b4b1c22`)
- **Project:** `ZeroSaaS P2P` (`9e2da614-7738-46a6-9152-69c4ec850ed5`)
- **Refinery Knowledge Base `KB-00`:** `2fb45197-ecd8-463e-b72b-db79275329e3`
- **Foundry Requirement `REQ-01`:** `1fc08c46-ed36-4a14-99a3-0eae8de04206`
- **Foundry Agent Session:** `6efbe532-dc88-467d-89fd-db361b5d1f75`
- **Matrix:** [`docs/software-factory-trace.md`](../../docs/software-factory-trace.md)

## Root Cause Of The Earlier Desk Name

Software Factory did not name the desk "Copper Command Desk". Before kickoff we wrote a local fallback work-order list for the Planner-to-build bridge (`sf_wo_bridge.py --from-fallback`), and its `WO-04` entry carried that title. The `WO-04` build row was lit from it (see `.sw-factory/WO-04/context.md`, which records the same title), and the builder built what the title said. The bridge script itself is not in this repository and was not read from this seat; the attribution rests on the `WO-04` title recorded here and on the team's own account of the kickoff.

## Prior Work Closed Since WO-12

- `WO-08` (`8721678d`) failed its Qualify Review on R10 (`targetRepo`). `WO-08.f1` was refused `tests_failed`; `WO-08.f2` (`6db3195f`) kept R10 open. `T20` (`c1d69467`) closed R10 by editing `targetRepo` and regenerating `seeds/coa_seed.journal` in one fence.
