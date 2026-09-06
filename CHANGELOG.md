# Changelog

## 0.3.22

- Added optional fixed vertical graph scale via `graph.vertical_axis.min` and `max`.
- Added `graph.vertical_axis.show` to show/hide the two Y-axis labels.
- Vertical-axis labels use the same typography as the horizontal time scale.

## 0.3.21

- Added a historical target-temperature setpoint line to activity mode.
- The setpoint line is shown only while `graph.activity.enabled: true`, so disabling activity mode also disables its history request and rendering.
- Target history is read from the room's main `climate` entity `temperature` attribute and drawn as a step line.
- Added `graph.activity.target_temperature.enabled`, `color`, `line_width`, and `opacity`.
- Default target-temperature color is green (`#66bb6a`) to remain distinct from cooling blue and heating orange.
- Target values participate in the graph Y range when the line is enabled, preventing the setpoint from being clipped outside the visible chart.

## 0.3.20

- Activity shading is now clipped to the sensor graph area instead of filling the full graph height.
- Active-device colors fill only the area below the sensor line, matching the Home Assistant area-graph style more closely.
- The regular sensor gradient remains disabled while `graph.activity.enabled: true`.

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
