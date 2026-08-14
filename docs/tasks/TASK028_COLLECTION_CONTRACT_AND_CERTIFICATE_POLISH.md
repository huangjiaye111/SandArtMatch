# TASK028: Collection Contract And Certificate Polish

## Depends On

- `TASK027_BATTLE_RESULT_AND_TOOL_PRESENTATION_HOOKS.md`

## Goal

Finish the Collection presentation contract for chapter list, artwork list, and artwork detail/certificate.

## Scope

- Preserve the three-layer structure: chapter list, artwork list, artwork detail/certificate.
- Map chapters to the first four themes: spring garden, beach holiday, cozy home, cloud dream.
- Use current artwork and theme catalogs for certificate data.
- Keep locked, unlocked, and collected states clear.

## Out Of Scope

- No new collection gameplay rules.
- No final art import beyond existing asset replacement keys.
- No social certificate sharing implementation.

## Acceptance Criteria

- Chapter list reports progress and status per theme.
- Artwork list reports locked, unlocked, and collected item states.
- Detail view exposes artwork, certificate, and placeholder frame information through typed data.
- Missing artwork and unknown theme cases are safe.
- `npm.cmd run typecheck` passes.
- `npm.cmd test` passes.

