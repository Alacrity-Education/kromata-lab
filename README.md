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

Those are the only two commands. Everything the Lab persists lives in `data/`, outside the Next
build output:

```
data/uploads/      originals + downscaled preview copies, swept after 24h
data/palettes.json custom palettes the team has saved
data/usage.jsonl   the usage log
```

### Docker

```bash
docker build -t kromata-lab .
docker run -p 3000:3000 -v "$(pwd)/data:/data" kromata-lab
```

Uses Next's standalone output and mounts `data/` as a volume. Builds with the legacy builder as
well as BuildKit, and needs no apt packages — sharp ships prebuilt glibc binaries. There is a
healthcheck on `/api/stats`.

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
newline list, or JSON. Naming a custom palette saves it to the server so the rest of the team can
pick it.

## Usage log and /stats

Every conversion appends a line to `data/usage.jsonl` with a timestamp, an anonymous session id,
the palette, mode, image dimensions and processing time. Thumbs up/down writes a second record
joined to the conversion by id — ratings arrive after the conversion, and editing a line in an
append-only file means rewriting the file.

Conversions are tagged `preview` or `download`. Previews fire on every debounced control change, so
counting them alone measures slider fiddling rather than use; **downloads are the number worth
watching**, and both are reported.

- `/stats` — the report, rendered.
- `/api/stats` — the same data as JSON: totals, per day, per palette, per session, per mode,
  average rating, median and p95 processing time.

No auth: this runs on an internal network. No telemetry beyond the log described here.

## API

| route | method | purpose |
| --- | --- | --- |
| `/api/upload` | POST | multipart, accepts JPEG/PNG/WebP up to 25 MB each |
| `/api/preview/[id]` | GET | the stored downscaled original, the "before" half |
| `/api/convert` | POST | maps one upload; returns image bytes plus `X-Kromata-Conversion-Id` |
| `/api/download-all` | POST | converts several at full resolution, returns a zip |
| `/api/rate` | POST | thumbs up/down on a conversion id |
| `/api/palettes` | GET/POST | list presets and saved palettes; save a new one |
| `/api/stats` | GET | the usage report as JSON |

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
