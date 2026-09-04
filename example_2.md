type: custom:lokio-climate-card
storage_key: main_climate
reset_metric_on_room_change: false
graph:
  hours_to_show: 24
  smoothing: 0.5
  time_labels: 5
  line_width: 2
  show_extrema: true
rooms:
  - id: gostinaya
    name: Гостиная
    climate: climate.climate_gostinaya
    sensors:
      temperature: sensor.temperature_out
      humidity: sensor.humidity_out
      co2: sensor.co2_gostinaya
    ac: climate.climate_ac_gostinaya
    ac_icon: mdi:snowflake
    radiator: switch.radiator_gostinaya
    reason: input_text.climate_gostinaya_action_reason
    target_temperature_visible: true
  - id: spalnya
    name: Гостиная
    climate: climate.climate_gostinaya
    sensors:
      temperature: sensor.humidity_out
      humidity: sensor.temperature_out
      co2: sensor.co2_gostinaya
    ac: climate.climate_ac_gostinaya
    radiator: switch.radiator_gostinaya
    reason: input_text.climate_gostinaya_action_reason
    target_temperature_visible: true
