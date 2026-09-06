/*
 * Lokio Climate Card
 * Standalone Lovelace climate dashboard card for Home Assistant.
 * v0.3.21
 */

const CARD_TAG = "lokio-climate-card";
const VERSION = "0.3.21";

const MODE_LABELS = {
  cool: "Охлаждение",
  heat: "Обогрев",
  idle: "Бездействие",
  off: "Выключено",
  auto: "Авто",
  dry: "Осушение",
  fan_only: "Вентиляция",
  heat_cool: "Авто",
};

const ACTION_LABELS = {
  cooling: "Охлаждение",
  heating: "Обогрев",
  idle: "Бездействие",
  off: "Выключено",
  drying: "Осушение",
  fan: "Вентиляция",
};

const PRESET_LABELS = {
  comfort: "Комфорт",
  eco: "Эконом",
  sleep: "Сон",
  away: "Нет дома",
  home: "Дома",
  boost: "Турбо",
  activity: "Активность",
  none: "Обычный",
};

const MODE_ICONS = {
  cool: "mdi:snowflake",
  heat: "mdi:radiator",
  auto: "mdi:thermostat",
  off: "mdi:power",
  dry: "mdi:water-percent",
  fan_only: "mdi:fan",
  heat_cool: "mdi:thermostat",
};

const MODE_COLORS = {
  off: "#9aa0a6",
  cool: "#4fc3f7",
  heat: "#ff9d45",
  auto: "#66bb6a",
  dry: "#7e8ce0",
  fan_only: "#4dd0e1",
  heat_cool: "#ffca5c",
};

const SENSOR_META = {
  temperature: { icon: "mdi:thermometer", color: "#ff9d45", digits: 1, fallbackUnit: "°C" },
  humidity: { icon: "mdi:water-percent", color: "#4fc3f7", digits: 0, fallbackUnit: "%" },
  co2: { icon: "mdi:molecule-co2", color: "#66bb6a", digits: 0, fallbackUnit: "ppm" },
};

class LokioClimateCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._selectedRoomId = null;
    this._selectedMetric = "temperature";
    this._history = [];
    this._historyEntity = null;
    this._historyFetchedAt = 0;
    this._historyLoading = false;
    this._activityHistory = { ac: [], radiator: [], hrv: [], target: [] };
    this._activityHistoryRoomId = null;
    this._activityFetchedAt = 0;
    this._activityLoading = false;
    this._renderQueued = false;
    this._holdTimer = null;
    this._holdTriggered = false;
    this._lastSensorStates = new Map();
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.rooms) || config.rooms.length === 0) {
      throw new Error("Lokio Climate Card: укажите хотя бы одну комнату в rooms:");
    }

    const activityConfig = config.graph?.activity || {};
    const normalized = {
      storage_key: "default",
      reset_metric_on_room_change: true,
      room_columns: 4,
      ...config,
      graph: {
        hours_to_show: 24,
        points: null,
        smoothing: 0.15,
        time_labels: 4,
        line_width: 2,
        show_extrema: true,
        refresh_seconds: 300,
        ...(config.graph || {}),
        activity: {
          enabled: false,
          ...activityConfig,
          ac: {
            enabled: true,
            opacity: 0.12,
            on_color: "#4fc3f7",
            cooling_color: "#4fc3f7",
            heating_color: "#ff9d45",
            drying_color: "#7e8ce0",
            fan_color: "#4dd0e1",
            ...(activityConfig.ac || {}),
          },
          radiator: {
            enabled: true,
            opacity: 0.12,
            color: "#ff9d45",
            ...(activityConfig.radiator || {}),
          },
          hrv: {
            enabled: true,
            opacity: 0.10,
            on_color: "#66bb6a",
            fan_color: "#4dd0e1",
            cooling_color: "#4fc3f7",
            heating_color: "#ffb74d",
            ...(activityConfig.hrv || {}),
          },
          target_temperature: {
            enabled: true,
            color: "#66bb6a",
            line_width: 1.2,
            opacity: 0.95,
            ...(activityConfig.target_temperature || {}),
          },
        },
      },
      rooms: config.rooms.map((room, index) => this._normalizeRoom(room, index)),
    };

    this._config = normalized;
    this._restoreUiState();
    this._ensureValidSelection();
    this._queueRender();
    // Home Assistant can assign hass before setConfig on some dashboard updates.
    // Start history requests here as well so activity bands are not missed.
    if (this._hass) {
      this._maybeLoadHistory(true);
      this._maybeLoadActivityHistory(true);
    }
  }

  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (!this._config) return;

    this._ensureValidSelection();
    this._queueRender();

    const entityId = this._selectedSensorEntity();
    if (entityId) {
      const currentState = hass?.states?.[entityId]?.state;
      const previousState = previous?.states?.[entityId]?.state;
      this._maybeLoadHistory(currentState !== previousState);
    }

    if (this._activityEnabled()) {
      const room = this._currentRoom();
      const acNow = room?.ac ? hass?.states?.[room.ac] : null;
      const acPrev = room?.ac ? previous?.states?.[room.ac] : null;
      const radiatorNow = room?.radiator ? hass?.states?.[room.radiator] : null;
      const radiatorPrev = room?.radiator ? previous?.states?.[room.radiator] : null;
      const hrvNow = room?.hrv ? hass?.states?.[room.hrv] : null;
      const hrvPrev = room?.hrv ? previous?.states?.[room.hrv] : null;
      const climateNow = room?.climate ? hass?.states?.[room.climate] : null;
      const climatePrev = room?.climate ? previous?.states?.[room.climate] : null;
      const activityChanged =
        acNow?.state !== acPrev?.state ||
        acNow?.attributes?.hvac_action !== acPrev?.attributes?.hvac_action ||
        radiatorNow?.state !== radiatorPrev?.state ||
        radiatorNow?.attributes?.hvac_action !== radiatorPrev?.attributes?.hvac_action ||
        hrvNow?.state !== hrvPrev?.state ||
        hrvNow?.attributes?.hvac_action !== hrvPrev?.attributes?.hvac_action ||
        climateNow?.attributes?.temperature !== climatePrev?.attributes?.temperature;
      this._maybeLoadActivityHistory(activityChanged);
    }
  }

  getCardSize() {
    return this._config?.rooms?.length > 1 ? 6 : 5;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  static getStubConfig() {
    return {
      storage_key: "main_climate",
      rooms: [
        {
          id: "living_room",
          name: "Гостиная",
          climate: "climate.living_room",
          sensors: {
            temperature: "sensor.living_room_temperature",
            humidity: "sensor.living_room_humidity",
          },
          target_temperature_visible: true,
        },
      ],
    };
  }

  _normalizeRoom(room, index) {
    if (!room || !room.id) throw new Error(`Lokio Climate Card: у комнаты #${index + 1} отсутствует id`);
    if (!room.name) throw new Error(`Lokio Climate Card: у комнаты ${room.id} отсутствует name`);
    if (!room.climate) throw new Error(`Lokio Climate Card: у комнаты ${room.id} отсутствует climate`);

    const sensors = {};
    for (const [metric, value] of Object.entries(room.sensors || {})) {
      if (!value) continue;
      sensors[metric] = typeof value === "string" ? { entity: value } : { ...value };
    }

    return {
      target_temperature_visible: true,
      ...room,
      sensors,
    };
  }

  _storageKey() {
    const user = this._hass?.user?.id || this._hass?.user?.name || "local";
    return `lokio-climate-card:${user}:${this._config?.storage_key || "default"}`;
  }

  _restoreUiState() {
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state?.selectedRoomId) this._selectedRoomId = state.selectedRoomId;
      if (state?.selectedMetric) this._selectedMetric = state.selectedMetric;
    } catch (_) {
      // Ignore malformed or blocked storage.
    }
  }

  _saveUiState() {
    try {
      localStorage.setItem(
        this._storageKey(),
        JSON.stringify({
          selectedRoomId: this._selectedRoomId,
          selectedMetric: this._selectedMetric,
        })
      );
    } catch (_) {
      // Storage is optional; card still works in memory.
    }
  }

  _ensureValidSelection() {
    if (!this._config) return;
    const room = this._config.rooms.find((r) => r.id === this._selectedRoomId) || this._config.rooms[0];
    this._selectedRoomId = room.id;

    const available = Object.keys(room.sensors || {});
    if (!available.includes(this._selectedMetric)) {
      this._selectedMetric = available.includes("temperature") ? "temperature" : available[0] || "temperature";
    }
  }

  _currentRoom() {
    return this._config?.rooms?.find((r) => r.id === this._selectedRoomId) || this._config?.rooms?.[0];
  }

  _selectedSensorEntity() {
    const room = this._currentRoom();
    return room?.sensors?.[this._selectedMetric]?.entity || null;
  }

  _selectRoom(roomId) {
    if (roomId === this._selectedRoomId) return;
    this._selectedRoomId = roomId;
    const room = this._currentRoom();

    if (this._config.reset_metric_on_room_change !== false) {
      this._selectedMetric = room?.sensors?.temperature ? "temperature" : Object.keys(room?.sensors || {})[0] || "temperature";
    } else if (!room?.sensors?.[this._selectedMetric]) {
      this._selectedMetric = room?.sensors?.temperature ? "temperature" : Object.keys(room?.sensors || {})[0] || "temperature";
    }

    this._history = [];
    this._historyEntity = null;
    this._activityHistory = { ac: [], radiator: [], hrv: [], target: [] };
    this._activityHistoryRoomId = null;
    this._saveUiState();
    this._queueRender();
    this._maybeLoadHistory(true);
    this._maybeLoadActivityHistory(true);
  }

  _selectMetric(metric) {
    const room = this._currentRoom();
    if (!room?.sensors?.[metric]) return;
    if (metric === this._selectedMetric) return;
    this._selectedMetric = metric;
    this._history = [];
    this._historyEntity = null;
    this._saveUiState();
    this._queueRender();
    this._maybeLoadHistory(true);
  }

  async _maybeLoadHistory(force = false) {
    if (!this._hass || !this._config || this._historyLoading) return;
    const entityId = this._selectedSensorEntity();
    if (!entityId) return;

    const refreshMs = Math.max(30, Number(this._config.graph.refresh_seconds) || 300) * 1000;
    const stale = Date.now() - this._historyFetchedAt > refreshMs;
    if (!force && entityId === this._historyEntity && !stale) return;

    this._historyLoading = true;
    this._historyEntity = entityId;
    try {
      const hours = Number(this._config.graph.hours_to_show) || 24;
      const end = new Date();
      const start = new Date(end.getTime() - hours * 3600 * 1000);
      // Do not request significant_changes_only: we want every state change stored
      // by Recorder. no_attributes keeps the payload small without reducing points.
      const path = `history/period/${encodeURIComponent(start.toISOString())}?filter_entity_id=${encodeURIComponent(entityId)}&end_time=${encodeURIComponent(end.toISOString())}&no_attributes`;
      const response = await this._hass.callApi("GET", path);
      const rows = Array.isArray(response?.[0]) ? response[0] : [];
      const points = rows
        .map((row) => ({
          t: Date.parse(row.last_changed || row.last_updated || start.toISOString()),
          v: Number(row.state),
        }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));

      if (this._historyEntity === entityId) {
        this._history = points;
        this._historyFetchedAt = Date.now();
      }
    } catch (err) {
      console.warn("Lokio Climate Card: history request failed", err);
      if (this._historyEntity === entityId) this._history = [];
    } finally {
      this._historyLoading = false;
      this._queueRender();
    }
  }

  _activityEnabled() {
    return this._config?.graph?.activity?.enabled === true;
  }

  _entityDomain(entityId) {
    return String(entityId || "").split(".", 1)[0] || "";
  }

  async _fetchHistoryRows(entityId, start, end, includeAttributes = false) {
    if (!entityId) return [];
    const noAttributes = includeAttributes ? "" : "&no_attributes";
    const path = `history/period/${encodeURIComponent(start.toISOString())}?filter_entity_id=${encodeURIComponent(entityId)}&end_time=${encodeURIComponent(end.toISOString())}${noAttributes}`;
    const response = await this._hass.callApi("GET", path);
    return Array.isArray(response?.[0]) ? response[0] : [];
  }

  async _maybeLoadActivityHistory(force = false) {
    if (!this._hass || !this._config || !this._activityEnabled() || this._activityLoading) return;

    const room = this._currentRoom();
    if (!room) return;

    const activity = this._config.graph.activity || {};
    const wantAc = activity.ac?.enabled !== false && Boolean(room.ac);
    const wantRadiator = activity.radiator?.enabled !== false && Boolean(room.radiator);
    const wantHrv = activity.hrv?.enabled !== false && Boolean(room.hrv);
    const wantTarget = activity.target_temperature?.enabled !== false && Boolean(room.climate);
    if (!wantAc && !wantRadiator && !wantHrv && !wantTarget) {
      this._activityHistory = { ac: [], radiator: [], hrv: [], target: [] };
      this._activityHistoryRoomId = room.id;
      return;
    }

    const refreshMs = Math.max(30, Number(this._config.graph.refresh_seconds) || 300) * 1000;
    const stale = Date.now() - this._activityFetchedAt > refreshMs;
    if (!force && this._activityHistoryRoomId === room.id && !stale) return;

    this._activityLoading = true;
    const requestedRoomId = room.id;
    try {
      const hours = Math.max(1, Number(this._config.graph.hours_to_show) || 24);
      const end = new Date();
      const start = new Date(end.getTime() - hours * 3600 * 1000);

      const acDomain = this._entityDomain(room.ac);
      const radiatorDomain = this._entityDomain(room.radiator);
      const hrvDomain = this._entityDomain(room.hrv);
      const [acResult, radiatorResult, hrvResult, targetResult] = await Promise.allSettled([
        wantAc ? this._fetchHistoryRows(room.ac, start, end, acDomain === "climate") : Promise.resolve([]),
        wantRadiator ? this._fetchHistoryRows(room.radiator, start, end, radiatorDomain === "climate") : Promise.resolve([]),
        wantHrv ? this._fetchHistoryRows(room.hrv, start, end, hrvDomain === "climate") : Promise.resolve([]),
        wantTarget ? this._fetchHistoryRows(room.climate, start, end, true) : Promise.resolve([]),
      ]);

      const acRows = acResult.status === "fulfilled" ? acResult.value : [];
      const radiatorRows = radiatorResult.status === "fulfilled" ? radiatorResult.value : [];
      const hrvRows = hrvResult.status === "fulfilled" ? hrvResult.value : [];
      const targetRows = targetResult.status === "fulfilled" ? targetResult.value : [];

      const mapRows = (rows, domain) => rows.map((row) => ({
        t: Date.parse(row.last_updated || row.last_changed || start.toISOString()),
        state: row.state || "",
        action: row.attributes?.hvac_action || "",
        domain,
      })).filter((row) => Number.isFinite(row.t));

      const ac = mapRows(acRows, acDomain);
      const radiator = mapRows(radiatorRows, radiatorDomain);
      const hrv = mapRows(hrvRows, hrvDomain);
      const target = targetRows.map((row) => ({
        t: Date.parse(row.last_updated || row.last_changed || start.toISOString()),
        v: Number(row.attributes?.temperature),
      })).filter((row) => Number.isFinite(row.t) && Number.isFinite(row.v));
      const currentTarget = Number(this._hass?.states?.[room.climate]?.attributes?.temperature);
      if (wantTarget && Number.isFinite(currentTarget)) {
        const last = target[target.length - 1];
        if (!last || last.v !== currentTarget || last.t < end.getTime() - 1000) {
          target.push({ t: end.getTime(), v: currentTarget });
        }
      }

      if (this._currentRoom()?.id === requestedRoomId) {
        this._activityHistory = { ac, radiator, hrv, target };
        this._activityHistoryRoomId = requestedRoomId;
        this._activityFetchedAt = Date.now();
      }
    } catch (err) {
      console.warn("Lokio Climate Card: activity history request failed", err);
      if (this._currentRoom()?.id === requestedRoomId) {
        this._activityHistory = { ac: [], radiator: [], hrv: [], target: [] };
        this._activityHistoryRoomId = requestedRoomId;
      }
    } finally {
      this._activityLoading = false;
      this._queueRender();
    }
  }

  _activityRects(minT, maxT, w, h) {
    if (!this._activityEnabled()) return "";
    const room = this._currentRoom();
    if (!room || this._activityHistoryRoomId !== room.id) return "";

    const cfg = this._config.graph.activity || {};
    const span = Math.max(1, maxT - minT);
    const x = (t) => ((Math.max(minT, Math.min(maxT, t)) - minT) / span) * w;
    const rects = [];

    const addIntervals = (rows, getStyle) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      const sorted = [...rows].sort((a, b) => a.t - b.t);
      for (let i = 0; i < sorted.length; i += 1) {
        const row = sorted[i];
        const nextT = i + 1 < sorted.length ? sorted[i + 1].t : maxT;
        const from = Math.max(minT, row.t);
        const to = Math.min(maxT, nextT);
        if (to <= from) continue;
        const style = getStyle(row);
        if (!style) continue;
        const x1 = x(from);
        const x2 = x(to);
        const width = Math.max(0, x2 - x1);
        if (width < 0.2) continue;
        rects.push(`<rect x="${x1.toFixed(2)}" y="0" width="${width.toFixed(2)}" height="${h}" fill="${this._escape(style.color)}" fill-opacity="${style.opacity.toFixed(3)}" />`);
      }
    };

    if (cfg.ac?.enabled !== false && room.ac) {
      const opacity = Math.max(0, Math.min(1, Number(cfg.ac?.opacity) || 0));
      addIntervals(this._activityHistory.ac, (row) => {
        if (row.domain === "switch") {
          return row.state === "on" ? { color: cfg.ac.on_color || cfg.ac.cooling_color || "#4fc3f7", opacity } : null;
        }
        const action = row.action || "";
        if (action === "cooling") return { color: cfg.ac.cooling_color || "#4fc3f7", opacity };
        if (action === "heating") return { color: cfg.ac.heating_color || "#ff9d45", opacity };
        if (action === "drying") return { color: cfg.ac.drying_color || "#7e8ce0", opacity };
        if (action === "fan") return { color: cfg.ac.fan_color || "#4dd0e1", opacity };
        // Fallback for climate history where hvac_action is unavailable.
        if (!action && row.state === "cool") return { color: cfg.ac.cooling_color || "#4fc3f7", opacity };
        if (!action && row.state === "heat") return { color: cfg.ac.heating_color || "#ff9d45", opacity };
        if (!action && row.state === "dry") return { color: cfg.ac.drying_color || "#7e8ce0", opacity };
        if (!action && row.state === "fan_only") return { color: cfg.ac.fan_color || "#4dd0e1", opacity };
        return null;
      });
    }

    if (cfg.radiator?.enabled !== false && room.radiator) {
      const opacity = Math.max(0, Math.min(1, Number(cfg.radiator?.opacity) || 0));
      addIntervals(this._activityHistory.radiator, (row) => {
        if (row.domain === "switch") {
          return row.state === "on" ? { color: cfg.radiator.color || "#ff9d45", opacity } : null;
        }
        const action = row.action || "";
        if (action === "heating") return { color: cfg.radiator.color || "#ff9d45", opacity };
        // Fallback for climate history that does not contain hvac_action.
        return !action && row.state === "heat" ? { color: cfg.radiator.color || "#ff9d45", opacity } : null;
      });
    }

    if (cfg.hrv?.enabled !== false && room.hrv) {
      const opacity = Math.max(0, Math.min(1, Number(cfg.hrv?.opacity) || 0));
      addIntervals(this._activityHistory.hrv, (row) => {
        if (row.domain === "switch") {
          return row.state === "on" ? { color: cfg.hrv.on_color || cfg.hrv.fan_color || "#66bb6a", opacity } : null;
        }
        const action = row.action || "";
        if (action === "cooling") return { color: cfg.hrv.cooling_color || "#4fc3f7", opacity };
        if (action === "heating") return { color: cfg.hrv.heating_color || "#ffb74d", opacity };
        if (action === "fan") return { color: cfg.hrv.fan_color || "#4dd0e1", opacity };
        // Fallback for climate HRV entities without historical hvac_action.
        if (!action && ["fan_only", "auto", "heat_cool"].includes(row.state)) {
          return { color: cfg.hrv.fan_color || cfg.hrv.on_color || "#66bb6a", opacity };
        }
        return null;
      });
    }

    return rects.length ? `<g class="activity-layer" pointer-events="none">${rects.join("")}</g>` : "";
  }

  _targetTemperaturePath(minT, maxT, x, y) {
    if (!this._activityEnabled()) return "";
    const room = this._currentRoom();
    if (!room || this._activityHistoryRoomId !== room.id) return "";
    const cfg = this._config.graph.activity?.target_temperature || {};
    if (cfg.enabled === false) return "";

    const rows = Array.isArray(this._activityHistory.target)
      ? this._activityHistory.target.filter((row) => Number.isFinite(row.t) && Number.isFinite(row.v)).sort((a, b) => a.t - b.t)
      : [];
    if (!rows.length) return "";

    // Target temperature is a setpoint, so draw it as a step line: each value
    // remains active until Home Assistant records the next target change.
    const visible = rows.filter((row) => row.t <= maxT);
    if (!visible.length) return "";
    let current = visible[0];
    for (const row of visible) {
      if (row.t <= minT) current = row;
      else break;
    }

    const segments = [{ t: minT, v: current.v }];
    for (const row of visible) {
      if (row.t <= minT || row.t > maxT) continue;
      const prev = segments[segments.length - 1];
      segments.push({ t: row.t, v: prev.v });
      segments.push({ t: row.t, v: row.v });
    }
    const lastValue = segments[segments.length - 1].v;
    segments.push({ t: maxT, v: lastValue });

    const d = segments.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    if (!d) return "";
    const color = cfg.color || "#66bb6a";
    const width = Math.max(0.5, Number(cfg.line_width) || 1.2);
    const opacity = Math.max(0, Math.min(1, Number(cfg.opacity) || 0.95));
    return `<path class="target-temperature-line" d="${d}" fill="none" stroke="${this._escape(color)}" stroke-opacity="${opacity.toFixed(3)}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" pointer-events="none" />`;
  }

  _queueRender() {
    if (this._renderQueued) return;
    this._renderQueued = true;
    requestAnimationFrame(() => {
      this._renderQueued = false;
      this._render();
    });
  }

  _entity(entityId) {
    return entityId ? this._hass?.states?.[entityId] : null;
  }

  _escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _formatSensor(metric, sensorConfig) {
    const st = this._entity(sensorConfig?.entity);
    const value = Number(st?.state);
    if (!Number.isFinite(value)) return "—";
    const meta = SENSOR_META[metric] || {};
    const digits = Number.isInteger(sensorConfig?.precision) ? sensorConfig.precision : (meta.digits ?? 1);
    const unit = sensorConfig?.unit ?? st?.attributes?.unit_of_measurement ?? meta.fallbackUnit ?? "";
    return `${value.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
  }

  _modeIcon(state) {
    return MODE_ICONS[state] || "mdi:thermostat";
  }

  _modeColor(state) {
    return MODE_COLORS[state] || MODE_COLORS.off;
  }

  _deviceIcon(room, kind) {
    const entityId = room?.[kind];
    const st = this._entity(entityId);
    const state = st?.state || "off";

    if (kind === "radiator") {
      const defaults = { on: "mdi:radiator", off: "mdi:radiator", heat: "mdi:radiator", auto: "mdi:radiator" };
      return room.radiator_icon || room.radiator_icons?.[state] || defaults[state] || "mdi:radiator";
    }

    if (kind === "hrv") {
      const defaults = {
        on: "mdi:air-filter",
        off: "mdi:air-filter",
        auto: "mdi:air-filter",
        fan_only: "mdi:air-filter",
        cool: "mdi:air-filter",
        heat: "mdi:air-filter",
      };
      return room.hrv_icon || room.hrv_icons?.[state] || defaults[state] || "mdi:air-filter";
    }

    const defaults = {
      on: "mdi:fan",
      off: "mdi:snowflake",
      fan_only: "mdi:fan",
      cool: "mdi:snowflake",
      heat: "mdi:radiator",
    };
    return room.ac_icon || room.ac_icons?.[state] || defaults[state] || defaults.off;
  }

  _deviceColor(room, kind) {
    const entityId = room?.[kind];
    const st = this._entity(entityId);
    const state = st?.state || "off";

    if (kind === "radiator") {
      const defaults = { on: "#ff9d45", off: "#9aa0a6", heat: "#ff9d45", auto: "#ff9d45" };
      return room.radiator_color || room.radiator_colors?.[state] || defaults[state] || defaults.off;
    }

    if (kind === "hrv") {
      const defaults = {
        on: "#4fc3f7",
        off: "#9aa0a6",
        auto: "#4fc3f7",
        fan_only: "#4fc3f7",
        cool: "#4fc3f7",
        heat: "#ff9d45",
      };
      return room.hrv_color || room.hrv_colors?.[state] || defaults[state] || defaults.off;
    }

    const defaults = {
      on: "#4fc3f7",
      off: "#9aa0a6",
      fan_only: "#4fc3f7",
      cool: "#2196f3",
      heat: "#ff9d45",
    };
    return room.ac_color || room.ac_colors?.[state] || defaults[state] || defaults.off;
  }

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId },
    }));
  }

  _bindLongPress(el, onTap, onHold) {
    if (!el) return;

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let moved = false;

    const cancelTimer = () => {
      if (this._holdTimer) clearTimeout(this._holdTimer);
      this._holdTimer = null;
    };

    const finish = () => {
      cancelTimer();
      pointerId = null;
      moved = false;
      this._holdTriggered = false;
    };

    el.onpointerdown = (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;

      this._holdTriggered = false;
      moved = false;
      pointerId = ev.pointerId;
      startX = ev.clientX;
      startY = ev.clientY;
      cancelTimer();

      try { el.setPointerCapture?.(ev.pointerId); } catch (_) {}

      this._holdTimer = setTimeout(() => {
        if (moved) return;
        this._holdTriggered = true;
        onHold?.();
      }, 550);
    };

    el.onpointermove = (ev) => {
      if (pointerId !== ev.pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.hypot(dx, dy) > 14) {
        moved = true;
        cancelTimer();
      }
    };

    el.onpointerup = (ev) => {
      if (pointerId !== null && pointerId !== ev.pointerId) return;
      cancelTimer();

      if (!this._holdTriggered && !moved) onTap?.();

      try { el.releasePointerCapture?.(ev.pointerId); } catch (_) {}
      finish();
    };

    el.onpointercancel = finish;
    el.onlostpointercapture = () => {
      if (pointerId !== null) finish();
    };
    el.oncontextmenu = (ev) => ev.preventDefault();
  }

  async _changeTarget(delta) {
    const room = this._currentRoom();
    const climate = this._entity(room?.climate);
    const current = Number(climate?.attributes?.temperature);
    const base = Number.isFinite(current) ? current : 20;
    const temperature = Math.round((base + delta) * 10) / 10;
    try {
      await this._hass.callService("climate", "set_temperature", {
        entity_id: room.climate,
        temperature,
      });
    } catch (err) {
      console.warn("Lokio Climate Card: set_temperature failed", err);
    }
  }

  _downsampleLttb(data, threshold) {
    if (!Array.isArray(data) || data.length <= threshold || threshold < 3) {
      return Array.isArray(data) ? data.slice() : [];
    }

    const sampled = [data[0]];
    const every = (data.length - 2) / (threshold - 2);
    let a = 0;

    for (let i = 0; i < threshold - 2; i += 1) {
      const avgRangeStart = Math.floor((i + 1) * every) + 1;
      const avgRangeEnd = Math.min(Math.floor((i + 2) * every) + 1, data.length);

      let avgX = 0;
      let avgY = 0;
      let avgRangeLength = Math.max(1, avgRangeEnd - avgRangeStart);

      for (let j = avgRangeStart; j < avgRangeEnd; j += 1) {
        avgX += data[j].t;
        avgY += data[j].v;
      }

      if (avgRangeEnd <= avgRangeStart) {
        const fallback = data[Math.min(data.length - 1, avgRangeStart)];
        avgX = fallback.t;
        avgY = fallback.v;
        avgRangeLength = 1;
      }

      avgX /= avgRangeLength;
      avgY /= avgRangeLength;

      const rangeOffs = Math.floor(i * every) + 1;
      const rangeTo = Math.min(Math.floor((i + 1) * every) + 1, data.length - 1);

      const pointA = data[a];
      let maxArea = -1;
      let maxAreaPoint = data[rangeOffs];
      let nextA = rangeOffs;

      for (let j = rangeOffs; j < rangeTo; j += 1) {
        const area = Math.abs(
          (pointA.t - avgX) * (data[j].v - pointA.v) -
          (pointA.t - data[j].t) * (avgY - pointA.v)
        );

        if (area > maxArea) {
          maxArea = area;
          maxAreaPoint = data[j];
          nextA = j;
        }
      }

      sampled.push(maxAreaPoint);
      a = nextA;
    }

    sampled.push(data[data.length - 1]);
    return sampled;
  }

  _prepareGraphPoints(points) {
    if (!Array.isArray(points) || points.length < 2) return [];

    // History can contain duplicate timestamps and isolated bad values after
    // restarts. mini-graph-card effectively hides much of that through its
    // aggregation/smoothing, so do the same here before drawing.
    const sorted = points
      .filter((p) => Number.isFinite(p?.t) && Number.isFinite(p?.v))
      .sort((a, b) => a.t - b.t);

    const deduped = [];
    for (const p of sorted) {
      const last = deduped[deduped.length - 1];
      if (last && last.t === p.t) last.v = p.v;
      else deduped.push({ t: p.t, v: p.v });
    }
    if (deduped.length < 3) return deduped;

    const metric = this._selectedMetric;
    const absoluteSpike = metric === "temperature" ? 2.5 : metric === "humidity" ? 18 : metric === "co2" ? 650 : Infinity;
    const cleaned = [deduped[0]];
    for (let i = 1; i < deduped.length - 1; i += 1) {
      const prev = deduped[i - 1];
      const cur = deduped[i];
      const next = deduped[i + 1];
      const neighborDelta = Math.abs(next.v - prev.v);
      const expected = prev.v + ((cur.t - prev.t) / Math.max(1, next.t - prev.t)) * (next.v - prev.v);
      const deviation = Math.abs(cur.v - expected);
      // Remove only an isolated spike: neighbors must agree with each other.
      if (Number.isFinite(absoluteSpike) && neighborDelta < absoluteSpike * 0.45 && deviation > absoluteSpike) continue;
      cleaned.push(cur);
    }
    cleaned.push(deduped[deduped.length - 1]);

    // Keep all cleaned Recorder state changes by default. `graph.points` is only
    // an optional upper limit for very dense histories; it never creates or
    // averages samples. If a limit is needed, LTTB is used internally because
    // it preserves peaks and turns much better than simple averaging.
    const hours = Math.max(1, Number(this._config?.graph?.hours_to_show) || 24);
    const end = Date.now();
    const start = end - hours * 3600000;
    const inWindow = cleaned.filter((p) => p.t >= start && p.t <= end);
    const source = inWindow.length >= 2 ? inWindow : cleaned;

    const requestedPoints = Number(this._config?.graph?.points);
    if (!Number.isFinite(requestedPoints) || requestedPoints < 3) return source;

    const totalPoints = Math.max(3, Math.round(requestedPoints));
    if (source.length <= totalPoints) return source;

    return this._downsampleLttb(source, totalPoints);
  }

  _graphPath(coords) {
    if (!coords.length) return "";
    if (coords.length === 1) return `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;

    const smoothing = Math.max(0, Math.min(1, Number(this._config?.graph?.smoothing) || 0));
    if (smoothing <= 0.001 || coords.length === 2) {
      return coords.reduce((d, p, i) =>
        `${d}${i === 0 ? "M" : " L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`, "");
    }

    // Catmull-Rom -> cubic Bezier. `smoothing` scales the control-point
    // distance: 0 = raw/angular, 1 = the original fully smoothed curve.
    const scale = smoothing / 6;
    let d = `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i += 1) {
      const p0 = coords[i - 1] || coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) * scale;
      const cp1y = p1.y + (p2.y - p0.y) * scale;
      const cp2x = p2.x - (p3.x - p1.x) * scale;
      const cp2y = p2.y - (p3.y - p1.y) * scale;
      d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

  _graphSvg(accent) {
    const points = this._prepareGraphPoints(this._history);
    if (!points || points.length < 2) {
      return `<div class="graph-empty">${this._historyLoading ? "Загрузка истории…" : "Нет данных графика"}</div>`;
    }

    const w = 640;
    const h = 124;
    const padX = 0;
    const padY = 6;
    const hours = Math.max(1, Number(this._config.graph.hours_to_show) || 24);
    const configuredEndT = Date.now();
    const configuredStartT = configuredEndT - hours * 3600000;

    // Use the configured time window when enough history is available. If HA
    // only returns a short recent fragment (for example just after startup),
    // stretch that available fragment across the graph instead of collapsing
    // it into a nearly vertical line at the right edge.
    const visiblePoints = points.filter((p) => p.t >= configuredStartT && p.t <= configuredEndT);
    const domainPoints = visiblePoints.length >= 2 ? visiblePoints : points;
    const dataMinT = Math.min(...domainPoints.map((p) => p.t));
    const dataMaxT = Math.max(...domainPoints.map((p) => p.t));
    const dataSpan = Math.max(1, dataMaxT - dataMinT);
    const configuredSpan = hours * 3600000;
    const useDataDomain = dataSpan < configuredSpan * 0.35;
    const minT = useDataDomain ? dataMinT : configuredStartT;
    const maxT = useDataDomain ? dataMaxT : configuredEndT;

    let minV = Math.min(...points.map((p) => p.v));
    let maxV = Math.max(...points.map((p) => p.v));
    const rawMinV = minV;
    const rawMaxV = maxV;
    const targetCfg = this._config.graph.activity?.target_temperature || {};
    const targetValues = this._activityEnabled() && targetCfg.enabled !== false && this._activityHistoryRoomId === this._currentRoom()?.id
      ? (this._activityHistory.target || []).filter((p) => p.t >= minT && p.t <= maxT && Number.isFinite(p.v)).map((p) => p.v)
      : [];
    if (targetValues.length) {
      minV = Math.min(minV, ...targetValues);
      maxV = Math.max(maxV, ...targetValues);
    }
    const valueRange = maxV - minV;
    const visualPad = valueRange > 0 ? valueRange * 0.10 : 0.5;
    minV -= visualPad;
    maxV += visualPad;

    const x = (t) => padX + ((t - minT) / Math.max(1, maxT - minT)) * (w - padX * 2);
    const y = (v) => h - padY - ((v - minV) / Math.max(0.0001, maxV - minV)) * (h - padY * 2);
    const coords = points
      .filter((p) => p.t >= minT && p.t <= maxT)
      .map((p) => ({ x: x(p.t), y: y(p.v), t: p.t, v: p.v }));

    if (coords.length < 2) {
      return `<div class="graph-empty">Нет данных графика</div>`;
    }

    const line = this._graphPath(coords);
    const first = coords[0];
    const last = coords[coords.length - 1];
    const area = `${line} L${last.x.toFixed(1)},${h} L${first.x.toFixed(1)},${h} Z`;
    const metricMeta = SENSOR_META[this._selectedMetric] || {};
    const sensor = this._currentRoom()?.sensors?.[this._selectedMetric];
    const state = this._entity(sensor?.entity);
    const unit = sensor?.unit ?? state?.attributes?.unit_of_measurement ?? metricMeta.fallbackUnit ?? "";
    const digits = Number.isInteger(sensor?.precision) ? sensor.precision : (metricMeta.digits ?? 1);
    const formatValue = (value) => {
      const fixed = Number(value).toFixed(digits);
      const trimmed = fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
      return `${trimmed}${unit ? ` ${unit}` : ""}`;
    };
    const formatTime = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    const minPoint = points.reduce((a, b) => b.v < a.v ? b : a, points[0]);
    const maxPoint = points.reduce((a, b) => b.v > a.v ? b : a, points[0]);
    const color = accent || "var(--climate-accent)";
    const showExtrema = this._config.graph.show_extrema !== false;
    const activityEnabled = this._activityEnabled();
    const activityRects = this._activityRects(minT, maxT, w, h);
    const targetTemperaturePath = activityEnabled ? this._targetTemperaturePath(minT, maxT, x, y) : "";

    const timeLabelCountRaw = Number(this._config.graph.time_labels);
    const timeLabelCount = Number.isFinite(timeLabelCountRaw)
      ? Math.max(0, Math.min(8, Math.round(timeLabelCountRaw)))
      : 4;
    const wholeHourEnd = new Date();
    wholeHourEnd.setMinutes(0, 0, 0);
    const endHourMs = wholeHourEnd.getTime();
    const startHourMs = endHourMs - hours * 3600000;
    const timeLabels = timeLabelCount > 0
      ? Array.from({ length: timeLabelCount }, (_, i) => {
          const ratio = timeLabelCount === 1 ? 0.5 : i / (timeLabelCount - 1);
          const raw = startHourMs + (endHourMs - startHourMs) * ratio;
          const aligned = Math.round(raw / 3600000) * 3600000;
          return `<span>${this._escape(new Date(aligned).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }))}</span>`;
        }).join("")
      : "";

    return `
      ${showExtrema ? `<div class="graph-extrema">
        <div class="extrema-block min-block"><span class="extrema-label">Min</span><span class="extrema-value">${this._escape(formatValue(rawMinV))}</span><span class="extrema-time">${this._escape(formatTime(minPoint.t))}</span></div>
        <div class="extrema-block max-block"><span class="extrema-label">Max</span><span class="extrema-value">${this._escape(formatValue(rawMaxV))}</span><span class="extrema-time">${this._escape(formatTime(maxPoint.t))}</span></div>
      </div>` : ""}
      <svg class="graph-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="График">
        <defs>
          <linearGradient id="lokio-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.18" />
            <stop offset="100%" stop-color="${color}" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="lokio-x-mask" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="white" stop-opacity="0" />
            <stop offset="17%" stop-color="white" stop-opacity="1" />
            <stop offset="83%" stop-color="white" stop-opacity="1" />
            <stop offset="100%" stop-color="white" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="lokio-y-mask" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="white" stop-opacity="1" />
            <stop offset="65%" stop-color="white" stop-opacity="1" />
            <stop offset="100%" stop-color="white" stop-opacity="0" />
          </linearGradient>
          <mask id="lokio-edge-mask">
            <rect width="100%" height="100%" fill="url(#lokio-x-mask)" />
          </mask>
          <mask id="lokio-bottom-mask">
            <rect width="100%" height="100%" fill="url(#lokio-y-mask)" />
          </mask>
          <clipPath id="lokio-graph-area-clip">
            <path d="${area}" />
          </clipPath>
        </defs>
        ${activityEnabled ? "" : `<g mask="url(#lokio-edge-mask)">
          <g mask="url(#lokio-bottom-mask)">
            <path d="${area}" fill="url(#lokio-fill)" />
          </g>
        </g>`}
        ${activityRects ? `<g clip-path="url(#lokio-graph-area-clip)">${activityRects}</g>` : ""}
        ${targetTemperaturePath ? `<g mask="url(#lokio-edge-mask)">${targetTemperaturePath}</g>` : ""}
        <g mask="url(#lokio-edge-mask)">
          <path d="${line}" fill="none" stroke="${color}" stroke-width="${Number(this._config.graph.line_width) || 2}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        </g>
      </svg>
      ${timeLabels ? `<div class="graph-time-axis" style="--time-label-count:${timeLabelCount}">${timeLabels}</div>` : ""}`;
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    if (!this._hass) {
      this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px">Lokio Climate Card: ожидание Home Assistant…</div></ha-card>`;
      return;
    }

    const room = this._currentRoom();
    if (!room) return;
    const climate = this._entity(room.climate);
    const mode = climate?.state || "off";
    const action = climate?.attributes?.hvac_action || "off";
    const preset = climate?.attributes?.preset_mode || "none";
    const targetVisible = room.target_temperature_visible !== false;
    const target = Number(climate?.attributes?.temperature);
    const currentTemp = Number(this._entity(room.sensors?.temperature?.entity)?.state);
    const difference = Number.isFinite(target) && Number.isFinite(currentTemp) ? target - currentTemp : NaN;
    const accent = this._modeColor(mode);
    const selectedSensor = room.sensors?.[this._selectedMetric];
    const selectedSensorMeta = SENSOR_META[this._selectedMetric] || {};
    const graphColor = selectedSensor?.color || selectedSensorMeta.color || accent;

    const sensorsHtml = Object.entries(room.sensors || {}).map(([metric, sensor]) => {
      if (!sensor?.entity) return "";
      const meta = SENSOR_META[metric] || {};
      const active = metric === this._selectedMetric;
      const icon = sensor.icon || meta.icon || "mdi:gauge";
      const color = sensor.color || meta.color || "var(--primary-color)";
      return `
        <button class="sensor ${active ? "active" : ""}" data-metric="${this._escape(metric)}" data-entity="${this._escape(sensor.entity)}" style="--sensor-color:${color}">
          <ha-icon icon="${this._escape(icon)}"></ha-icon>
          <span>${this._escape(this._formatSensor(metric, sensor))}</span>
        </button>`;
    }).join("");

    const deviceDefs = [
      { kind: "ac", entity: room.ac, title: "Кондиционер" },
      { kind: "radiator", entity: room.radiator, title: "Радиатор" },
      { kind: "hrv", entity: room.hrv, title: "Вентиляция / HRV" },
    ].filter((item) => Boolean(item.entity));
    const devices = deviceDefs.map((item, index) => `${index ? '<span class="device-separator"></span>' : ''}<button class="device" data-device-entity="${this._escape(item.entity)}" title="${this._escape(item.title)}"><ha-icon icon="${this._escape(this._deviceIcon(room, item.kind))}" style="color:${this._deviceColor(room, item.kind)}"></ha-icon></button>`).join("");

    const roomButtons = this._config.rooms.length > 1 ? `
      <div class="room-grid" style="--room-columns:${Math.max(1, Math.min(8, Math.round(Number(this._config.room_columns) || 4)))}">
        ${this._config.rooms.map((r) => {
          const st = this._entity(r.climate);
          const temp = Number(this._entity(r.sensors?.temperature?.entity)?.state);
          return `<button class="room-button ${r.id === room.id ? "selected" : ""}" data-room="${this._escape(r.id)}">
            <span class="room-name">${this._escape(r.name)}</span>
            <ha-icon icon="${this._escape(this._modeIcon(st?.state || "off"))}" style="color:${this._modeColor(st?.state || "off")}"></ha-icon>
            <span class="room-temp">${Number.isFinite(temp) ? `${temp.toFixed(1)}°` : "—"}</span>
          </button>`;
        }).join("")}
      </div>` : "";

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card class="root-card" style="--climate-accent:${accent}">
        <div class="main ${targetVisible ? "with-target" : "without-target"}">
          <button class="header" id="header">
            <span class="climate-icon-wrap"><ha-icon icon="${this._escape(this._modeIcon(mode))}"></ha-icon></span>
            <span class="header-text">
              <span class="title">${this._escape(room.name)}</span>
              <span class="status">${this._escape(MODE_LABELS[mode] || mode || "—")} • ${this._escape(ACTION_LABELS[action] || action || "—")}</span>
              <span class="preset">${this._escape(PRESET_LABELS[preset] || preset || "—")}</span>
            </span>
          </button>

          <div class="devices device-count-${deviceDefs.length}">${devices}</div>
          <div class="sensors">${sensorsHtml}</div>
          <div class="graph">${this._graphSvg(graphColor)}</div>

          ${targetVisible ? `
            <div class="target">
              <button class="target-btn" data-target-delta="0.5"><ha-icon icon="mdi:chevron-up"></ha-icon></button>
              <div class="target-value">${Number.isFinite(target) ? `${target.toFixed(1)}°C` : "—"}</div>
              <div class="difference ${Number.isFinite(difference) ? (difference > 0 ? "positive" : difference < 0 ? "negative" : "neutral") : "neutral"}">
                ${Number.isFinite(difference) ? `${difference > 0 ? "+" : ""}${difference.toFixed(1)}°C` : "—"}
              </div>
              <button class="target-btn" data-target-delta="-0.5"><ha-icon icon="mdi:chevron-down"></ha-icon></button>
            </div>` : ""}
        </div>
      </ha-card>
      ${roomButtons}
    `;

    this.shadowRoot.querySelectorAll("[data-room]").forEach((el) => {
      el.onclick = () => this._selectRoom(el.dataset.room);
    });

    this.shadowRoot.querySelectorAll(".sensor").forEach((el) => {
      this._bindLongPress(
        el,
        () => this._selectMetric(el.dataset.metric),
        () => this._fireMoreInfo(el.dataset.entity)
      );
    });

    this.shadowRoot.querySelectorAll("[data-device-entity]").forEach((el) => {
      el.onclick = () => this._fireMoreInfo(el.dataset.deviceEntity);
    });

    this.shadowRoot.querySelectorAll("[data-target-delta]").forEach((el) => {
      el.onclick = () => this._changeTarget(Number(el.dataset.targetDelta));
    });

    this._bindLongPress(
      this.shadowRoot.getElementById("header"),
      () => this._fireMoreInfo(room.climate),
      () => this._fireMoreInfo(room.reason)
    );

    this._maybeLoadHistory(false);
    this._maybeLoadActivityHistory(false);
  }

  _styles() {
    return `
      :host { display:block; }
      * { box-sizing:border-box; }
      button { font:inherit; color:inherit; -webkit-tap-highlight-color:transparent; }
      .root-card {
        height:230px;
        padding:14px 18px 4px 18px;
        border-radius:20px;
        background:var(--lokio-button-card-background-color, var(--ha-card-background, var(--card-background-color)));
        border:1px solid var(--lokio-climate-control-border, var(--divider-color));
        box-shadow:none;
        overflow:hidden;
      }
      .main { height:100%; display:grid; column-gap:2px; row-gap:0; }
      .main.with-target {
        grid-template-areas:"header devices target" "sensors sensors target" "graph graph target";
        grid-template-columns:minmax(0,1fr) 73px 96px;
        grid-template-rows:44px 48px 1fr;
      }
      .main.without-target {
        grid-template-areas:"header devices" "sensors sensors" "graph graph";
        grid-template-columns:minmax(0,1fr) auto;
        grid-template-rows:44px 48px 1fr;
      }
      .header {
        grid-area:header; border:0; background:transparent; padding:0; margin:0;
        display:grid; grid-template-areas:"icon title" "icon status" "icon preset";
        grid-template-columns:40px minmax(0,1fr); grid-template-rows:18px 13px 13px;
        column-gap:8px; align-items:center; text-align:left; cursor:pointer;
      }
      .climate-icon-wrap {
        grid-area:icon; width:36px; height:36px; border-radius:12px;
        display:flex; align-items:center; justify-content:center;
        background:color-mix(in srgb, var(--climate-accent) 15%, transparent);
        border:1px solid color-mix(in srgb, var(--climate-accent) 45%, transparent);
      }
      .climate-icon-wrap ha-icon { width:21px; height:21px; color:var(--climate-accent); display:block; margin:0; --mdc-icon-size:21px; }
      .header-text { display:contents; }
      .title { grid-area:title; align-self:end; font-size:14px; font-weight:500; line-height:18px; color:var(--lokio-climate-text-color, var(--primary-text-color)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .status { grid-area:status; font-size:10px; line-height:13px; color:var(--lokio-button-card-state-color, var(--secondary-text-color)); white-space:nowrap; }
      .preset { grid-area:preset; font-size:10px; line-height:13px; color:var(--lokio-button-card-state-color, var(--secondary-text-color)); opacity:.8; white-space:nowrap; }
      .devices { grid-area:devices; height:44px; display:flex; align-items:center; justify-content:center; gap:6px; transform:translateY(-6px); }
      .without-target .devices { justify-self:end; }
      .devices.device-count-3 { gap:2px; }
      .device { width:30px; height:30px; padding:0; border:0; background:transparent; display:flex; align-items:center; justify-content:center; cursor:pointer; }
      .devices.device-count-3 .device { width:21px; }
      .device ha-icon { width:21px; height:21px; display:block; margin:0; --mdc-icon-size:21px; }
      .device-separator { width:1px; height:18px; background:var(--lokio-climate-control-border, var(--divider-color)); opacity:.8; }
      .sensors { grid-area:sensors; position:relative; z-index:10; transform:translateY(-5px); display:flex; align-items:center; gap:12px; min-width:0; overflow:visible; }
      .sensor { position:relative; z-index:11; height:25px; padding:0; border:0; background:transparent; display:grid; grid-template-columns:20px auto; column-gap:5px; align-items:center; cursor:pointer; white-space:nowrap; touch-action:manipulation; user-select:none; -webkit-user-select:none; }
      .sensor ha-icon { width:18px; height:18px; color:var(--lokio-climate-icon-color, var(--secondary-text-color)); display:block; margin:0; --mdc-icon-size:18px; transform:translateY(-2px); pointer-events:none; }
      .sensor:active { background:color-mix(in srgb, var(--primary-text-color) 5%, transparent); }
      .sensor.active ha-icon { color:var(--sensor-color); }
      .sensor span { font-size:14px; line-height:24px; color:var(--lokio-climate-text-color, var(--primary-text-color)); pointer-events:none; }
      .graph { grid-area:graph; align-self:start; position:relative; z-index:1; transform:translateY(-32px); min-width:0; height:155px; overflow:visible; }
      .graph-extrema { position:absolute; left:0; right:30px; top:18px; height:30px; display:flex; justify-content:space-between; align-items:flex-start; padding:0; pointer-events:none; z-index:2; }
      .extrema-block { display:flex; flex-direction:column; gap:0; color:var(--lokio-button-card-state-color, var(--secondary-text-color)); font-family:inherit; font-size:8px; font-weight:400; line-height:10px; opacity:.9; }
      .max-block { align-items:flex-end; text-align:right; }
      .extrema-label, .extrema-value, .extrema-time { display:block; }
      .graph-svg { position:absolute; left:-14px; right:-18px; bottom:12px; width:calc(100% + 32px); height:108px; display:block; overflow:visible; }
      .graph-time-axis { position:absolute; left:-8px; right:-12px; bottom:4px; display:grid; grid-template-columns:repeat(var(--time-label-count), minmax(0,1fr)); align-items:end; pointer-events:none; color:var(--lokio-button-card-state-color, var(--secondary-text-color)); font-size:9px; font-weight:400; line-height:10px; opacity:.82; z-index:3; }
      .graph-time-axis span { min-width:0; text-align:center; white-space:nowrap; }
      .graph-time-axis span:first-child { text-align:left; padding-left:6px; }
      .graph-time-axis span:last-child { text-align:right; }
      .graph-empty { height:145px; display:flex; align-items:center; justify-content:center; color:var(--secondary-text-color); font-size:11px; opacity:.7; }
      .target { grid-area:target; transform:translate(8px, -22px); height:140px; align-self:center; display:grid; grid-template-rows:38px 38px 25px 38px; row-gap:2px; justify-items:center; align-items:center; }
      .target-btn { width:38px; height:38px; padding:0; border-radius:12px; background:var(--lokio-climate-control-background, color-mix(in srgb, var(--primary-text-color) 6%, transparent)); border:1px solid var(--lokio-climate-control-border, var(--divider-color)); box-shadow:none; cursor:pointer; display:grid; place-items:center; line-height:0; }
      .target-btn ha-icon { width:18px; height:18px; color:var(--lokio-climate-control-icon-color, var(--secondary-text-color)); display:block; margin:0; --mdc-icon-size:18px; }
      .target-value { font-size:30px; font-weight:400; line-height:38px; color:var(--lokio-climate-text-color, var(--primary-text-color)); white-space:nowrap; }
      .difference { height:25px; min-width:55px; padding:0 8px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:500; }
      .difference.negative { color:#4fc3f7; background:color-mix(in srgb, #4fc3f7 22%, transparent); }
      .difference.positive { color:#ff9d45; background:color-mix(in srgb, #ff9d45 25%, transparent); }
      .difference.neutral { color:var(--lokio-climate-difference-color, var(--secondary-text-color)); background:var(--lokio-climate-difference-background, color-mix(in srgb, var(--primary-text-color) 6%, transparent)); }
      .room-grid { margin-top:8px; display:grid; grid-template-columns:repeat(var(--room-columns, 4), minmax(0,1fr)); gap:8px; }
      .room-button { height:50px; padding:6px; border-radius:10px; background:var(--lokio-button-card-background-color, var(--ha-card-background, var(--card-background-color))); box-shadow:none; border:1px solid var(--lokio-climate-control-border, var(--divider-color)); display:grid; grid-template-areas:"name icon" "temp temp"; grid-template-columns:minmax(0,1fr) 26px; grid-template-rows:20px 1fr; row-gap:2px; cursor:pointer; text-align:left; }
      .room-button.selected { border:2px solid var(--primary-color); }
      .room-name { grid-area:name; align-self:start; font-size:10px; font-weight:600; line-height:14px; color:var(--lokio-climate-text-color, var(--primary-text-color)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .room-button ha-icon { grid-area:icon; justify-self:center; align-self:center; width:16px; height:16px; display:block; margin:0; --mdc-icon-size:16px; }
      .room-temp { grid-area:temp; align-self:end; font-size:14px; font-weight:400; line-height:18px; color:var(--lokio-climate-text-color, var(--primary-text-color)); }
      @media (max-width:420px) {
        .root-card { padding-left:14px; padding-right:14px; }
        .sensors { gap:9px; }
        .sensor span { font-size:13px; }
      }
    `;
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, LokioClimateCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "Lokio Climate Card",
    description: "Автономная многокомнатная климатическая карточка с локальным UI-состоянием.",
    preview: true,
  });
}

console.info(`%c LOKIO-CLIMATE-CARD %c v${VERSION} `, "color:white;background:#03a9f4;font-weight:700", "color:#03a9f4;background:#111");
