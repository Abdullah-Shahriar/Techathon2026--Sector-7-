import test from "node:test";
import assert from "node:assert/strict";
import { ROOM_DEFINITIONS } from "../src/deviceCatalog.js";
import { SimulatorStateStore } from "../src/stateStore.js";
import { OFFICE_MAX_POWER_WATTS, ROOM_MAX_POWER_WATTS } from "../src/types.js";

test("room all-on power is 165W and office all-on power is 495W", () => {
  const store = new SimulatorStateStore("Asia/Dhaka", new Date("2026-07-03T00:00:00.000Z"));

  for (const room of ROOM_DEFINITIONS) {
    store.setRoomStatus(room.roomId, "on", new Date("2026-07-03T03:00:00.000Z"));
    assert.equal(store.calculateRoomPower(room.roomId), ROOM_MAX_POWER_WATTS);
  }

  assert.equal(store.calculateOfficePower(), OFFICE_MAX_POWER_WATTS);
});

test("off devices consume 0W", () => {
  const store = new SimulatorStateStore("Asia/Dhaka", new Date("2026-07-03T00:00:00.000Z"));
  store.setAllStatus("on", new Date("2026-07-03T03:00:00.000Z"));
  store.setAllStatus("off", new Date("2026-07-03T04:00:00.000Z"));

  assert.equal(store.calculateOfficePower(), 0);
  for (const room of ROOM_DEFINITIONS) {
    assert.equal(store.calculateRoomPower(room.roomId), 0);
  }
});

test("lastChanged changes only when status changes and onSince follows on state", () => {
  const store = new SimulatorStateStore("Asia/Dhaka", new Date("2026-07-03T00:00:00.000Z"));
  const turnOnAt = new Date("2026-07-03T15:39:00.000Z");
  const unchangedAt = new Date("2026-07-03T15:45:00.000Z");
  const turnOffAt = new Date("2026-07-03T15:50:00.000Z");

  const turnedOn = store.setDeviceStatus("work1-fan-1", "on", turnOnAt);
  assert.equal(turnedOn.lastChanged, "2026-07-03T21:39:00.000+06:00");
  assert.equal(turnedOn.onSince, "2026-07-03T21:39:00.000+06:00");
  assert.equal(turnedOn.currentPowerWatts, 60);

  const unchanged = store.setDeviceStatus("work1-fan-1", "on", unchangedAt);
  assert.equal(unchanged.lastChanged, turnedOn.lastChanged);
  assert.equal(unchanged.onSince, turnedOn.onSince);

  const turnedOff = store.setDeviceStatus("work1-fan-1", "off", turnOffAt);
  assert.equal(turnedOff.lastChanged, "2026-07-03T21:50:00.000+06:00");
  assert.equal(turnedOff.onSince, null);
  assert.equal(turnedOff.currentPowerWatts, 0);
});

test("editable wattage and measurement profiles affect current power only while on", () => {
  const store = new SimulatorStateStore("Asia/Dhaka", new Date("2026-07-03T00:00:00.000Z"));

  store.setDeviceWattage("work1-fan-1", { ratedPowerWatts: 120, customPowerWatts: 80 });
  let fan = store.setDeviceStatus("work1-fan-1", "on");
  assert.equal(fan.currentPowerWatts, 120);

  fan = store.setDeviceMeasurementProfile("work1-fan-1", "low");
  assert.equal(fan.currentPowerWatts, 66);

  fan = store.setDeviceMeasurementProfile("work1-fan-1", "max");
  assert.equal(fan.currentPowerWatts, 150);

  fan = store.setDeviceMeasurementProfile("work1-fan-1", "custom");
  assert.equal(fan.currentPowerWatts, 80);

  fan = store.setDeviceStatus("work1-fan-1", "off");
  assert.equal(fan.currentPowerWatts, 0);

  fan = store.setDeviceWattage("work1-fan-1", { reset: true });
  assert.equal(fan.ratedPowerWatts, 60);
  assert.equal(fan.customPowerWatts, null);
  assert.equal(fan.currentPowerWatts, 0);
});

test("wattage validation rejects impossible values", () => {
  const store = new SimulatorStateStore("Asia/Dhaka", new Date("2026-07-03T00:00:00.000Z"));

  assert.throws(
    () => store.setDeviceWattage("work1-fan-1", { ratedPowerWatts: 151 }),
    /ratedPowerWatts must be between 10W and 150W/
  );
  assert.throws(
    () => store.setDeviceWattage("work1-light-1", { ratedPowerWatts: 0 }),
    /ratedPowerWatts must be between 1W and 100W/
  );
});
