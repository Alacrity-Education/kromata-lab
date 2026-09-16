# Decisions — Kromata Lab

Judgment calls that deviate from, or fill gaps in, the original spec. One line of reasoning each.
The core library keeps its own DECISIONS.md in the
[kromata repo](https://github.com/Alacrity-Education/kromata).

## Architecture

- **Uploads are stored server side and referred to by id**, rather than re-posting the file on
  every control change. Debounced previews against a 25 MB original would re-upload it on every
  slider nudge, which is the difference between the Lab feeling live and feeling broken.
- **Previews render from a downscaled copy (1600 px long edge); downloads always use the
  original.** Interactive feedback has to be fast, and nobody judges a palette at full resolution
  on screen. Downscaling is done once at upload, not per request.
- **`@alacrity-education/kromata-core` is an npm dependency, not a local path dependency.** A path
  dependency was the original plan, but it forces Next's Turbopack root and file-tracing root up to
  the parent directory to resolve a sibling symlink, and the standalone build then traced the whole
  sibling monorepo into the output: 226 MB instead of 39 MB. To develop against a local checkout
  instead, run `pnpm link ../Kromata/packages/core` (and `pnpm unlink` to go back).
- **Route handlers, not server actions.** The conversion endpoints return image bytes and custom
  headers; server actions are the wrong shape for that.
- **The page reads the palette list straight from the library** rather than fetching its own API
  over HTTP. Same process, one less hop.

## The usage log

- **Ratings are a separate JSONL record joined by conversion id**, rather than a field on the
  conversion's own line. Ratings arrive after the conversion, and editing a line in an append-only
  file means rewriting the file.
- **Every conversion is logged, but tagged `preview` or `download`.** The spec asked for every
  conversion. Previews fire on every debounced control change, so counting them alone measures
  slider fiddling rather than use. Both numbers are reported, and `/stats` says which one matters.
- **Stats are recomputed from the whole file on every request**, not cached in memory. Honest
  across restarts, and fine at the scale of one internal team; revisit if the file reaches millions
  of lines.
- **Appends are serialized through one promise chain.** Individual writes are small enough that the
  `O_APPEND` write would be atomic anyway, but this also keeps ordering stable under concurrency.
- **A log write failure never fails the conversion.** The log is for deciding whether to build the
  Payload plugin; it is not worth a 500 to the designer waiting on an image.
- **`GET /stats` is a page, `GET /api/stats` is the JSON.** The spec said `GET /stats` but also put
  every endpoint under `app/api/*`; this satisfies both, and the page links to the JSON.

## Behaviour

- **Toggling a rating off is a local undo and records nothing.** Only real opinions reach the log.
- **Ratings are cleared when a conversion is re-rendered**, because the rating referred to the
  previous result, not to the new settings.
- **Conversions run one at a time per batch**, not in parallel. The work is CPU-bound, so firing
  them together would only make the first result arrive later.
- **An in-flight batch is aborted when settings change again**, so dragging a slider leaves one
  request outstanding rather than a queue of stale ones.
- **The previous result stays on screen, dimmed, while the next one renders.** A spinner would say
  less than the image being compared.
- **Uploads are swept after 24 hours, opportunistically on upload.** Nothing to schedule, and an
  idle server does no work.
- **The working set is client state and does not survive a reload.** No auth and no project
  concept were asked for; the uploads stay on the server for the TTL either way.

## Limits

- 25 MB per file and JPEG/PNG/WebP only, as specified. 50 images per zip, 256 colors per saved
  palette, 200 saved palettes — none of these were specified; they exist so one request cannot
  exhaust the server.
- **The zip is stored, not deflated.** PNG, WebP and JPEG are already compressed, so deflating
  again costs real time and saves almost nothing.

## Deployment

- **The Dockerfile copies `.next/static` into the standalone tree.** Next emits it outside, and
  without this step the server starts and serves HTML while every stylesheet and client chunk
  404s — it looks like a CSS bug, not a deployment one. Verified by hitting it.
- **`node:22-bookworm-slim`, not Alpine.** sharp ships prebuilt glibc binaries, so this needs no
  build toolchain and no extra apt packages.
- **`pnpm-workspace.yaml` exists in a non-workspace project** because pnpm 11 reads its settings
  (`allowBuilds`) from there.
