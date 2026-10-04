# Changelog

## 0.3.35

- Removed the temporary HRV history debug exporter and all related debug UI/code.
- Updated README with current release information and complete configuration examples.
- Kept the activity-fill continuity fix from 0.3.34: adjacent active history intervals are rendered as continuous areas without false visual gaps.

## 0.3.34
- Fixed activity fill rendering: consecutive history samples with the same active state are merged into continuous SVG intervals.
- Prevented fractional-pixel seams between adjacent activity rectangles from appearing as false interruptions.
- No changes to activity state detection: climate activity still uses `hvac_mode`/entity state, with `hvac_action` only assisting color selection for composite modes.

# Changelog


## 0.3.31

- Activity shading for climate entities is now driven by the climate state (`hvac_mode`) rather than `hvac_action`.
- `hvac_action: idle` no longer creates artificial gaps while the climate remains in an active mode.
- Composite modes such as `auto` and `heat_cool` use the last real `hvac_action` only to choose the activity color.
- Transient `unknown` / `unavailable` climate history rows keep the previous active mode instead of breaking the activity band.
- Explicit `hvac_mode: off` still ends the activity interval.
- Updated documentation to describe the new climate activity logic.

## 0.3.30

- Fixed activity shading so climate devices follow their stable operating mode instead of treating normal `hvac_action: idle` duty-cycle periods as device shutdowns.
- Activity history is cached independently per room.
- Target-temperature history and activity rendering continue to use the selected room cache.

## 0.3.28

- Shifted the first time-axis label farther right when `graph.vertical_axis.show: true`.
- Improved automatic Y-axis scaling: isolated extreme samples no longer flatten the useful graph range.
- Auto scaling uses the central 90% of values when at least 20 samples are available; source graph points and Min/Max extrema remain unchanged.
- Explicit `graph.vertical_axis.min` / `max` values still take absolute priority.

## 0.3.27

- Shifted the first time-axis label to the right when `graph.vertical_axis.show: true`, preventing overlap with the lower Y-axis label.

## 0.3.26

- Target setpoint line is now metric-aware.
- The climate `temperature` setpoint is drawn only on the temperature graph.
- The target line is hidden on CO2 and other non-temperature/non-humidity graphs.
- If the room climate entity exposes a numeric `humidity` attribute, its historical target humidity is drawn on the humidity graph.
- Target temperature and target humidity share the existing `graph.activity.target_temperature` styling settings.

## 0.3.25

- Fixed target-temperature line visibility: it is now rendered as the final SVG layer, above the sensor graph and activity fills.
- Removed the edge mask from the target-temperature line to avoid SVG masking/render-order issues.

## 0.3.24

- Fixed target-temperature line disappearing when multiple rooms are configured.
- Target line now reads the selected room's own cached activity history instead of a shared active buffer.
- Added a live setpoint fallback so the target line is drawn even when Recorder returns no historical temperature attribute rows.
- Included the live setpoint in Y-axis range calculation.

## 0.3.23

- Fixed target-temperature history when switching between multiple rooms.
- Activity/target history is now cached independently per room instead of using one shared global buffer.
- Activity requests for one room no longer block another room, removing a race that could leave the target-temperature line missing.
- Reuses cached activity history immediately when returning to a room.


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
