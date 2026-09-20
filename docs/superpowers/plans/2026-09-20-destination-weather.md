# Destination Weather Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add free current destination weather and date-specific trip forecasts to both existing websites, then publish and verify them.

**Architecture:** Keep the itinerary HTML and existing interactions intact. Add a dependency-free classic JavaScript weather data module, a DOM controller, and scoped CSS to `original/`; mirror these into `public/` for the Sites iframe. Read Open-Meteo directly in the browser; use per-city storage, 30-minute freshness, request coalescing and network timeout handling.

**Tech Stack:** Existing HTML/CSS/JavaScript, browser fetch/localStorage/Intl, Node built-in test runner, existing vinext hosting wrapper.

## Global Constraints

- User approved current weather plus daily forecasts and publishing both existing public URLs; no subscription, API key, backend or location permission.
- Preserve all existing itinerary, hotel, transport and checklist data. Keep `sources/` untouched.
- Match forecasts by full local date, not array index. Show both cities for travel days and Pisa/Florence; Vatican uses Rome.
- Null is unavailable, never zero. Future dates outside the rolling 16-day range are pending; past days are not presented as current forecasts.
- Clearly label cached/stale/error data and model-based current conditions. Attribute Open-Meteo.
- Preserve dependencies and existing site identity/audience. Reuse the established local build and native Sites publication path.

## Task 1: Weather data and resilient cache

**Files:** Create `original/weather.js`, `tests/weather.test.mjs`.
**Interfaces:** `TripWeather.cities`, `dayCities(date)`, `recommendedCity(now)`, `localDate(now, timezone)`, `forecastState(data,date,cityId,now)`, `describeWeather(code,isDay)`, `createWeatherStore({fetchImpl,storage,now,timeoutMs})`. Store exposes `get(cityId,{force})` returning `{data,fetchedAt,stale,error}` without throwing on network failures.

- [ ] Write tests with literal local dates, two-city day mappings, unknown weather codes and null probabilities. Use controlled external HTTP responses to exercise the real cache and URL builder.
- [ ] Run `node --test tests/weather.test.mjs`; observe the missing-feature failures.
- [ ] Implement the interfaces, validating provider date/time and numeric fields, timezone and units. Use credentials omitted and no referrer; timeout after 12 seconds; coalesce requests; cache for 30 minutes; bound failed/forced retry to one minute.
- [ ] Verify cold load, fresh cache reuse, expiry, corrupt/blocked storage, malformed responses, HTTP failure, timeout, failure with stale data, null versus zero and cross-timezone dates. Commit when green.

## Task 2: Existing-page integration and accessible layout

**Files:** Create `original/weather-ui.js`, `original/weather.css`, `scripts/sync-trip.mjs`; update `original/index.html`, `original/README.md`, `package.json`; generate mirrored `public/trip.html`, `public/weather.js`, `public/weather-ui.js`, `public/weather.css`.
**Interfaces:** The controller consumes Task 1 and binds `#weatherCity`, `#weatherCurrent`, `#weatherRefresh`, `#weatherStatus`, and `[data-weather-date]`. The sync script copies only the four owned weather/itinerary assets.

- [ ] Add integration tests ensuring the deployed copies match and the itinerary stays unchanged; observe initial failures before wiring.
- [ ] Add a destination weather section, city selector (main destinations plus transit optgroup), refresh control, clear freshness/status text and attribution. Add forecast slots inside every daily card.
- [ ] Load each required city once, render failures independently, refresh visible pages every 30 minutes and on return/online. Reserve layout space; use SVG icons, labelled controls, focus rings and mobile-friendly wrapping.
- [ ] Run `node scripts/sync-trip.mjs`, `npm test`, `npm run lint`, and `npm run build`. Preview via a local static server and verify actual API data, city switching, cross-city cards, pending dates, narrow viewport, keyboard usability and existing filters/checklist.

## Task 3: Review and publish

- [ ] Request an independent whole-change review while running browser QA; fix important findings with reproducing tests.
- [ ] Commit exact tested source. Push the same full commit to the existing Sites source main and GitHub main, without force.
- [ ] Package only `.openai/hosting.json` plus validated `dist/`; save and deploy using the native Sites tools. Verify GitHub Pages workflow matches the same commit.
- [ ] Open both production URLs and confirm live current-weather and forecast output. Stop the local preview and report the URLs and any genuine limitations.

## Review focus

Incorrect timezone/date selection, future/past dates, unknown/nullable fields, stale data presented as fresh, malformed cache, cache stampedes, retry storms, status text after city changes, DOM injection, blocked storage, static relative paths, iframe integration and preservation of existing trip data.

## Verification and review record

- Data and rendering tests were observed failing before implementation, then passing. A regression for the overnight Dubai arrival keeps Dubai on October 8 only.
- Browser QA: actual data loaded for all nine cities; Paris and Pisa current conditions, date-matched dual-city forecasts, future pending dates, manual refresh, keyboard focus and 390px layout verified without horizontal overflow. Existing itinerary content is unchanged.
- Independent final review found one important issue: a partly aged startup cache could remain labelled fresh until the page's next 30-minute timer. A controller regression reproduced the issue, then passed after adding a visible-only minute age check. Fresh entries still avoid network requests. All 20 tests pass, lint and production build pass.
- Reviewer confirmed no remaining Critical, Important or Minor findings. The sole declined item (live deployment and final visual QA) is accepted as the main agent's responsibility and is checked during publication.
- The design skill guided accessible controls, explicit state labels and narrow-screen wrapping; the existing palette and itinerary layout were preserved.
