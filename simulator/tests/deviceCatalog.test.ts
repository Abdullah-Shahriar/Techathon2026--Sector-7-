import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVICE_CATALOG,
  ROOM_DEFINITIONS,
  assertCatalogIntegrity,
  getDevicesForRoom
} from "../src/deviceCatalog.js";
import { FAN_POWER_WATTS, LIGHT_POWER_WATTS } from "../src/types.js";

test("device catalog has exactly 15 fixed devices", () => {
  assert.doesNotThrow(() => assertCatalogIntegrity());
  assert.equal(DEVICE_CATALOG.length, 15);
  assert.equal(new Set(DEVICE_CATALOG.map((device) => device.id)).size, 15);
});

test("each room has exactly 2 fans and 3 lights", () => {
  for (const room of ROOM_DEFINITIONS) {
    const devices = getDevicesForRoom(room.roomId);
    assert.equal(devices.length, 5);
    assert.equal(devices.filter((device) => device.type === "fan").length, 2);
    assert.equal(devices.filter((device) => device.type === "light").length, 3);
  }
});

test("device ids and rated powers match the project contract", () => {
  for (const device of DEVICE_CATALOG) {
    assert.match(device.id, /^(drawing|work1|work2)-(fan|light)-[1-3]$/);

    if (device.type === "fan") {
      assert.match(device.id, /-fan-[1-2]$/);
      assert.equal(device.ratedPowerWatts, FAN_POWER_WATTS);
    }

    if (device.type === "light") {
      assert.equal(device.ratedPowerWatts, LIGHT_POWER_WATTS);
    }
  }
});
