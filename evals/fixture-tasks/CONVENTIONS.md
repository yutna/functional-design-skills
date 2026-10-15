# Conventions

## Errors in HTTP handlers

A handler throws `HttpError` for anything the caller got wrong. The
function `toResponse` in `src/http/server.ts` is the one place that turns
an error into a response, so a handler does not return an error value and
does not build an error response itself.

This is deliberate. Three client teams parse the error body, and one
place owning its shape is what keeps the three in step.

## Domain modules

Modules under `src/domain` are pure: no I/O, no clock, no randomness. An
expected failure there is returned as a `Result` from `src/result.ts`.

## Scripts

Anything under `scripts/` is throwaway unless `package.json` names it.

## The legacy folder

`src/legacy` predates `src/domain` and keeps its own style. Changes there
match the file they are in.
