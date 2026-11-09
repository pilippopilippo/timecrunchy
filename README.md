# timecrunchy

Training zones from a ramp test FTP or threshold heart rate, the week-by-week plans of *The Time-Crunched Cyclist*, and every ride for the trainer as a `.zwo` workout.

**Live:** https://pilippopilippo.github.io/timecrunchy/

One source for three places: the standalone page above, the calculator in the post [Time-crunched training](https://cknlgs.cc/blog/time-crunched-training/) on cknlgs.cc, and the workouts of [nofun](https://github.com/pilippopilippo/nofun).

## What is in it

| File | What |
| --- | --- |
| `src/data.js` | Zones (Table 4.1 of the book) and the 9 plans, transcribed from the book's tables |
| `src/targets.js` | Zone shares → % FTP and % threshold heart rate, watts and bpm, the text of each ride |
| `src/text.js` | The calculator's text (English) |
| `src/zwo.js` | Rides → `.zwo` workouts |
| `src/calculator.js` | The `<zone-calculator>` element |
| `src/zone-calculator.css` | Its style; colors come from the page's theme variables (see `site/site.css`) |

The book sets every target as a share of its own 8-minute field test. Threshold power is about 0.9 × the test power and threshold heart rate about 0.93 × the test heart rate, so the shares are converted to apply to an FTP and a threshold heart rate.

## The workouts

The rules are in `src/zwo.js`:

- The EM time is the length of the whole ride, with the intervals inside it: 10 min warm-up, the intervals, EM up to the length, 5 min cool-down. With a range (60–90 min) the shortest length that fits the intervals.
- ERG targets in the middle of each zone: EM 65%, SS 98%, CR 108% of FTP; PowerIntervals 120%; recoveries 55%.
- Each interval also carries its zone as a range, `PowerRangeLow`/`PowerRangeHigh` (`OnPowerRangeLow`… on `IntervalsT`): EM 50–81.1%, SS 95.6–100%, CR 105.6–111.1%, PI 112.2–130% (PowerIntervals have no upper limit). `Power` stays the middle, so apps that don't know the range hold it; an app that does can move the target inside the range. Recoveries, warm-up and cool-down are fixed.
- Peak-and-Fade PowerIntervals start all out and fade, which ERG can't do: they use a 6% slope.
- Group rides, commutes, races, cyclocross practice and Gran Fondo days are outdoors: no file. When a day offers two options, the first one without outdoor parts is used. Rides of 3 hours or more, group, hilly and MTB rides are marked `outdoorSuggested`.

## API (static, on Pages)

Base: `https://pilippopilippo.github.io/timecrunchy/`

| Path | Content |
| --- | --- |
| `v1/zones.json` | Zones as shares of FTP and threshold heart rate, ERG targets and ranges, cadences |
| `v1/plans.json` | The plans: id, name, group, week labels, number of rides |
| `v1/plans/<id>.json` | Every ride of a plan: id, week, day, text, `trainer`, `minutes`, `title`, `outdoorSuggested`, `url` of the `.zwo` |
| `v1/zwo/<id>/<file>.zwo` | One workout, e.g. `v1/zwo/new-granfondo/w3-sat.zwo` |
| `timecrunchy.js` | The library as one ES module |
| `zone-calculator.js`, `zone-calculator.css` | The element as a classic script, for pages that inline it |

GitHub Pages serves every file with `Access-Control-Allow-Origin: *`.

**Versions.** Releases are tagged `vX.Y.Z` (semver). `v1/` stays compatible: new fields can appear, none is removed or changes meaning; a breaking change goes to `v2/`. Ride ids and file names don't change, because apps keep them.

## Using it from another project

The blog and nofun keep a copy of the built files, pinned to a tag, and update it with their own `scripts/update-timecrunchy.mjs <tag>`: the script checks out the tag, builds it and copies the files. A copy is easy to review in a diff, works offline and never changes by itself.

## Development

```
npm ci
npm test        # builds dist/ and runs the tests
npm start       # http://localhost:8080/timecrunchy/
```

`test/calculator.test.js` checks that the element shows exactly what the blog's calculator showed before the move (`test/fixtures/`, cknlgs-blog at `1b330d9`), for every plan and week. Update the fixture when the plans or the text change on purpose.

Release: bump `version` in `package.json`, commit, tag `vX.Y.Z`, push with `--tags`.

## Credits and license

Zones and plans from *The Time-Crunched Cyclist* by Chris Carmichael (3rd edition), adapted to a ramp test FTP and threshold heart rate. Code under the MIT License (`LICENSE`).
