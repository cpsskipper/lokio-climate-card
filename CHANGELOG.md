# Changelog


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
