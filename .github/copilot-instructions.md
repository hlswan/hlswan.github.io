# Copilot Instructions

## General Guidelines
- Use event id 'rsg.credits' instead of 'rsg.finish' for the API; prefer 'rsg.credits' in all code references.
- Use event id 'rsg.first_portal' instead of 'rsg.enter_portal' across the codebase.

## Twitch Channel Selection
- When selecting Twitch channels, use `run.user.liveAccount` to determine live streams; do not fallback to `run.user.login` or `run.nickname`.
- Default to `DEFAULT_CHANNEL` when no `liveAccount` is available.
- Take note of the helper functions isRunLive and filterToLiveRuns for Twitch channel selection logic.
- Preferred run selection flow: filter runs to live runs first, display only live runs, and show any live sub10-paced run(s). If no sub10-paced runs are available, call `findLiveTopRunners(topList)` to query Twitch for which top runners are streaming and use the top two streaming top runners to populate iframes.
- Add verbose console logging to show exactly how runs are sorted; log run metadata before/after sorting and comparator decisions.