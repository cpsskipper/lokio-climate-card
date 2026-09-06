# Changelog

## 0.3.19

- When `graph.activity.enabled: true`, the regular sensor area gradient is no longer drawn.
- Activity bands remain visible beneath the graph line without competing with the normal graph fill.
- When activity mode is disabled, the original graph gradient fill is unchanged.

## 0.3.18

- Fixed activity bands not appearing reliably after dashboard/card initialization.
- Activity bands are now rendered above the sensor area fill and below the graph line for better visibility.
- Added HRV activity history and shading via `graph.activity.hrv`.
- `ac`, `radiator`, and `hrv` activity sources support both `switch` and `climate`.
- Added climate-state fallback when historical `hvac_action` is missing.

## 0.3.17

- AC activity shading now supports both `switch` and `climate` entities. Switch activity uses `on` intervals; climate activity uses historical `hvac_action`.
- Radiator activity shading now supports both `switch` and `climate` entities. Climate radiators are shaded only while `hvac_action` is `heating`.
- Added a dedicated optional `hrv` room entity with its own device icon, color overrides and state maps.
- Added `hrv_icon`, `hrv_color`, `hrv_icons` and `hrv_colors`.
- Updated public examples and documentation.

## 0.3.16

- Added optional Home Assistant-style graph background shading for AC and radiator operation.
- Added `graph.activity.enabled` master switch; default is `false`, so no extra activity history requests are made unless explicitly enabled.
- AC shading uses historical `hvac_action` (`cooling`, `heating`, `drying`, `fan`) and radiator shading uses `on` intervals.
- Added per-device enable switches, opacity settings and optional activity colors.
- Activity history is refreshed using the existing `graph.refresh_seconds` interval and cached separately from the selected sensor history.

## 0.3.15

- Restored sensor buttons to their original 25 px touch height.
- Moved the sensors layer above the graph so the graph can no longer intercept sensor taps.
- Removed the enlarged invisible sensor touch extension introduced in 0.3.14.

## 0.3.14

- Expanded the sensor touch target downward by 16 px without moving the visible icon or text.
- Slightly widened the invisible touch target for more reliable mobile taps.

All notable changes to Lokio Climate Card are documented here.


## 0.3.13

- Added `room_columns` to configure the number of room selector buttons per row.
- Default remains 4 columns. Values are clamped to 1–8.

## 0.3.12

- Prepared the project for a public GitHub repository and HACS custom-repository installation.
- Replaced private/example-specific Home Assistant entity IDs with neutral public examples.
- Added HACS validation and JavaScript syntax-check GitHub Actions.
- Added `.gitignore`, `CONTRIBUTING.md`, `SECURITY.md` and GitHub issue templates.
- Expanded README and installation documentation for GitHub Releases and HACS.
- No intended functional UI behavior changes from 0.3.11.

## 0.3.11

- Packaged the existing card as a documented project with README, examples and configuration/install documentation.

## 0.3.10

- Shifted the left-most time-scale label slightly to the right.

## 0.3.9

- Enlarged sensor touch targets and improved pointer handling on touch devices.
- Adjusted the left Min label position.

## 0.3.8

- Restored stable graph behavior and added configurable smoothing and whole-hour time labels.
