# Decisions — Kromata Lab

Judgment calls that deviate from, or fill gaps in, the original spec. One line of reasoning each.
The core library keeps its own DECISIONS.md in the
[kromata repo](https://github.com/Alacrity-Education/kromata).

## Architecture

- **Uploads are held server side in memory and referred to by id**, rather than re-posting the file
  on every control change. Debounced previews against a 25 MB original would re-upload it on every
  slider nudge, which is the difference between the Lab feeling live and feeling broken.
- **Nothing is written to disk.** The Lab is deployed on Coolify as a stateless container, so there
  is no volume to provision and a redeploy leaves nothing behind. Uploads are transient working
  files, not documents, so losing them on restart costs nothing. Two consequences, both accepted:
  the store is bounded (`KROMATA_MAX_STORE_MB`, default 512) and evicts least-recently-used uploads
  rather than growing without limit, and it lives in one process, so the app assumes one replica.
- **There is no usage log, no ratings and no /stats.** All three were built and then removed once
  the deployment target ruled out persistence; ratings existed only to feed the log, so they went
  with it. The history is in git if the question of whether to build the Payload plugin needs
  numbers later.
- **Custom palettes are not saved.** They travel with each render. Adding a palette permanently
  means adding it to the core library's presets, which is a versioned change rather than mutable
  server state.
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

## Behaviour

- **Conversions run one at a time per batch**, not in parallel. The work is CPU-bound, so firing
  them together would only make the first result arrive later.
- **An in-flight batch is aborted when settings change again**, so dragging a slider leaves one
  request outstanding rather than a queue of stale ones.
- **The previous result stays on screen, dimmed, while the next one renders.** A spinner would say
  less than the image being compared.
- **Uploads are swept after 2 hours, opportunistically on upload.** Nothing to schedule, and an
  idle server does no work. Shorter than the old on-disk TTL because these now occupy RAM.
- **The working set is client state and does not survive a reload.** No auth and no project
  concept were asked for; the uploads stay on the server for the TTL either way.

## Limits

- 25 MB per file and JPEG/PNG/WebP only, as specified. 50 images per zip, and the in-memory store
  ceiling — neither was specified; they exist so one request cannot exhaust the server.
- **The zip is stored, not deflated.** PNG, WebP and JPEG are already compressed, so deflating
  again costs real time and saves almost nothing.

## Deployment

- **No volume and no required environment**, so Coolify can run the image as-is.
- **The Dockerfile copies `.next/static` into the standalone tree.** Next emits it outside, and
  without this step the server starts and serves HTML while every stylesheet and client chunk
  404s — it looks like a CSS bug, not a deployment one. Verified by hitting it.
- **`node:22-bookworm-slim`, not Alpine.** sharp ships prebuilt glibc binaries, so this needs no
  build toolchain and no extra apt packages.
- **`pnpm-workspace.yaml` exists in a non-workspace project, and declares `packages: ['.']`.**
  pnpm 11 reads its settings (`allowBuilds`, `minimumReleaseAgeExclude`) only from this file, but
  pnpm 9 and 10 read the file as a workspace definition and abort with "packages field missing or
  empty" — which is exactly how a Nixpacks build fails. The `packages` entry satisfies both.
  Verified against pnpm 9, 10 and 11.
- **`packageManager` is pinned**, so corepack and any build platform use the pnpm the lockfile was
  written by instead of guessing.
- **`@alacrity-education/kromata-core` is excluded from pnpm's minimum-release-age policy.** pnpm 11
  rejects dependencies published within roughly the last day, which blocks any build for a day
  after we publish the library. The exclusion is scoped to our own first-party package rather than
  turning the policy off.
- **Build with the Dockerfile, not Nixpacks.** The Dockerfile is pinned and tested; Nixpacks infers
  the toolchain and does not know about the standalone output.
