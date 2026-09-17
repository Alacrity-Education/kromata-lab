# Kromata Lab

The design team's test app for [Kromata](https://github.com/Alacrity-Education/kromata): drop in
real photos and illustrations, try palettes, judge the results.

Built on Next.js (App Router) — the same runtime Payload CMS runs on, so the Lab and a future
Payload plugin stay on one stack. All image work happens server side through
[`@alacrity-education/kromata-core`](https://www.npmjs.com/package/@alacrity-education/kromata-core);
nothing is processed in the browser.

## Running it

```bash
pnpm install
pnpm dev                      # http://localhost:3000
```

```bash
pnpm build && pnpm start      # production
```

Those are the only two commands.

**The Lab writes nothing to disk.** Uploads are held in a bounded in-memory store and dropped on
restart, so the container is stateless: no volume, nothing to back up, nothing to migrate. Set
`KROMATA_MAX_STORE_MB` (default 512) to change the ceiling; past it the least recently used
uploads are evicted, and an image that has been evicted reports "no longer on the server, upload
it again" rather than failing silently.

### Docker

```bash
docker build -t kromata-lab .
docker run -p 3000:3000 kromata-lab
```

Uses Next's standalone output. No volumes, no environment required. Builds with the legacy builder
as well as BuildKit, and needs no apt packages — sharp ships prebuilt glibc binaries. There is a
healthcheck on `/api/palettes`.

Because the upload store lives in one process, run a **single replica**; two behind a round-robin
proxy would miss each other's uploads.

### Coolify

Set the build pack to **Dockerfile**, not Nixpacks. The Dockerfile pins Node and pnpm and handles
Next's standalone output; Nixpacks infers the toolchain and gets both wrong. No volume and no
environment variables are required. Expose port 3000 and run one replica.

## How it works

**Upload once, preview from a copy.** Files are stored server side and referred to by id. Previews
render from a downscaled copy (1600 px long edge) so the controls stay responsive; downloads always
use the original at full resolution. Re-posting a 25 MB file on every slider nudge is the
difference between the Lab feeling live and feeling broken.

**Debounced, abortable renders.** Changing a control waits 300 ms, then converts each image in turn.
Changing it again aborts the batch in flight, so dragging a slider leaves one request outstanding
rather than a queue of stale ones. The previous result stays on screen, dimmed, while the next one
renders.

**Views.** A draggable before/after split, a 2-up, and a grid for scanning many at once. Download
one, or all of them as a zip.

**Palettes.** Every preset from the core library, plus a custom box that takes a hex list, a
newline list, or JSON. Custom colors travel with each render and are not stored. To add a palette
permanently, add it to the core library's presets and bump the dependency here.

## API

| route | method | purpose |
| --- | --- | --- |
| `/api/upload` | POST | multipart, accepts JPEG/PNG/WebP up to 25 MB each |
| `/api/preview/[id]` | GET | the stored downscaled original, the "before" half |
| `/api/convert` | POST | maps one upload; returns image bytes |
| `/api/download-all` | POST | converts several at full resolution, returns a zip |
| `/api/palettes` | GET | the built-in presets |

## Working on core at the same time

The Lab depends on the published package. To point it at a local checkout:

```bash
pnpm link ../Kromata/packages/core     # then rebuild core to see changes
pnpm unlink ../Kromata/packages/core   # back to the published version
```

A permanent path dependency was the original plan; see [DECISIONS.md](./DECISIONS.md) for why it
was dropped.

## License

MIT.
