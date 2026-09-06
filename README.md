# Lokio Climate Card

Standalone multi-room climate card for Home Assistant dashboards.

**Current version: 0.3.17**

Lokio Climate Card combines room selection, climate state, temperature/humidity/CO₂ sensors, target-temperature controls, device status and a Recorder history graph in one custom card. Selected room and graph metric are stored locally in the browser, so no helper entities or synchronization automation are required.

## Features

- multiple rooms in one card;
- room selector automatically hidden when only one room is configured;
- browser-local selected room and graph metric;
- temperature, humidity and CO₂ sensors, plus custom sensor definitions;
- tap a sensor to switch the graph, hold for Home Assistant `more-info`;
- built-in Recorder history graph with Min/Max, smoothing and time labels;
- optional Home Assistant-style graph activity shading for AC and radiator operation (`switch` or `climate`);
- target-temperature controls, optionally hidden per room;
- separate AC, radiator and HRV/ventilation device indicators;
- fixed or state-dependent MDI icons and colors;
- no `input_select` helpers required;
- no `button-card`, `mini-graph-card`, `config-template-card` or `card-mod` dependency.

## Install with HACS as a custom repository

1. Publish this repository on GitHub as a **public** repository named `lokio-climate-card`.
2. In Home Assistant open **HACS → Dashboard**.
3. Open the HACS menu and choose **Custom repositories**.
4. Add `https://github.com/<github-username>/lokio-climate-card` and select category **Dashboard**.
5. Open **Lokio Climate Card** in HACS and click **Download**.
6. Reload the browser after installation.

HACS should register the dashboard resource automatically. If you manage Lovelace resources manually, use:

```yaml
url: /hacsfiles/lokio-climate-card/lokio-climate-card.js
type: module
```

See [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for GitHub release and manual installation instructions.

## Minimal configuration

```yaml
type: custom:lokio-climate-card
storage_key: living_room_climate
room_columns: 4  # Number of room buttons per row (1–8)

rooms:
  - id: living_room
    name: Living room
    climate: climate.living_room
    sensors:
      temperature: sensor.living_room_temperature
      humidity: sensor.living_room_humidity
    ac: climate.living_room_ac
    radiator: switch.living_room_radiator
    hrv: switch.living_room_hrv
    target_temperature_visible: true
```

All entity IDs above are examples. Replace them with entities from your Home Assistant instance.

## Recommended graph configuration

```yaml
graph:
  hours_to_show: 24
  points: null
  smoothing: 0
  time_labels: 5
  line_width: 2
  show_extrema: true
  refresh_seconds: 300

  # Optional. Disabled by default, so it adds no extra history requests unless enabled.
  activity:
    enabled: false
```

`points: null` uses all available Recorder state changes after the card's built-in cleanup. Increasing `points` cannot create measurements that are not present in Recorder.

`smoothing: 0` draws the unsmoothed line. Values from `0.1` to `0.25` provide light smoothing; `1` is the strongest smoothing. `time_labels: 0` hides the time scale.

### Device activity shading

Activity shading is disabled by default. When enabled, the card requests additional Recorder history only for the configured AC and/or radiator and paints their active intervals behind the sensor graph.

```yaml
graph:
  activity:
    enabled: true
    ac:
      enabled: true
      opacity: 0.12
    radiator:
      enabled: true
      opacity: 0.12
```

Both `ac` and `radiator` may point to either a `switch` or a `climate` entity. For a `climate` entity the card reads historical `hvac_action`; AC supports `cooling`, `heating`, `drying` and `fan`, while radiator shading is drawn only for `hvac_action: heating`. For a `switch`, the `on` intervals are shaded. If `activity.enabled` is `false`, these extra history requests and activity layers are not used.

Optional AC colors are `on_color`, `cooling_color`, `heating_color`, `drying_color` and `fan_color`. `on_color` is used when `ac` is a switch. `activity.radiator.color` is used for both switch `on` intervals and climate `heating` intervals.

## Full room example

```yaml
- id: living_room
  name: Living room
  climate: climate.living_room

  sensors:
    temperature:
      entity: sensor.living_room_temperature
      icon: mdi:thermometer
      color: "#ff9d45"
      precision: 1
    humidity:
      entity: sensor.living_room_humidity
      icon: mdi:water-percent
      color: "#4fc3f7"
      precision: 0
    co2:
      entity: sensor.living_room_co2
      icon: mdi:molecule-co2
      color: "#66bb6a"
      precision: 0

  ac: climate.living_room_ac
  radiator: switch.living_room_radiator
  hrv: switch.living_room_hrv
  reason: input_text.living_room_climate_reason
  target_temperature_visible: true
```

The short sensor syntax is also supported:

```yaml
sensors:
  temperature: sensor.living_room_temperature
  humidity: sensor.living_room_humidity
  co2: sensor.living_room_co2
```

## Device icons and colors

Fixed values:

```yaml
ac_icon: mdi:air-conditioner
ac_color: "#4fc3f7"
radiator_icon: mdi:radiator
radiator_color: "#ff9d45"
hrv_icon: mdi:air-filter
hrv_color: "#4fc3f7"
```

State-dependent values:

```yaml
ac_icons:
  "on": mdi:fan
  "off": mdi:fan-off
  cool: mdi:snowflake
  heat: mdi:radiator

ac_colors:
  "on": "#4fc3f7"
  "off": "#9aa0a6"
  cool: "#2196f3"
  heat: "#ff9d45"

radiator_icons:
  "on": mdi:radiator
  "off": mdi:radiator

radiator_colors:
  "on": "#ff9d45"
  "off": "#9aa0a6"

hrv_icons:
  "on": mdi:air-filter
  "off": mdi:air-filter
hrv_colors:
  "on": "#4fc3f7"
  "off": "#9aa0a6"
```

Fixed `ac_icon`/`ac_color` values take priority over the state maps. Radiator and HRV options behave the same way.

## Local UI state

The card stores only the selected room and selected graph metric in browser `localStorage`. The key is scoped by the Home Assistant user and `storage_key`.

Use a different `storage_key` for each independent card instance:

```yaml
storage_key: first_floor
```

## Tap and hold behavior

- header tap → `more-info` for the room climate entity;
- header hold → `more-info` for `reason`, when configured;
- sensor tap → select that metric for the graph;
- sensor hold → sensor `more-info`;
- AC/radiator/HRV tap → device `more-info`;
- target arrows → change the target temperature by 0.5 °C.

Sensor controls use their normal visual touch area and are kept above the graph layer so the graph cannot intercept sensor taps.

## Documentation

- [`docs/INSTALLATION.md`](docs/INSTALLATION.md) — GitHub, HACS and manual installation;
- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) — configuration reference;
- [`examples/full-example.yaml`](examples/full-example.yaml) — fully commented multi-room example;
- [`examples/one-room.yaml`](examples/one-room.yaml) — single-room example;
- [`examples/custom-icons.yaml`](examples/custom-icons.yaml) — icon/color customization;
- [`CHANGELOG.md`](CHANGELOG.md) — release history.

## Repository structure

```text
lokio-climate-card/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/validate.yaml
├── dist/
│   └── lokio-climate-card.js
├── docs/
│   ├── CONFIGURATION.md
│   └── INSTALLATION.md
├── examples/
│   ├── custom-icons.yaml
│   ├── full-example.yaml
│   └── one-room.yaml
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── SECURITY.md
├── example-card.yaml
├── hacs.json
├── lokio-climate-card.js
└── package.json
```

## License

MIT. See [`LICENSE`](LICENSE).
