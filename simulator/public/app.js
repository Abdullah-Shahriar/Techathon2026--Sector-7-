const OFFICE_MAX_POWER_WATTS = 495;
const ROOM_MAX_POWER_WATTS = 165;
const MAX_LOCAL_EVENTS = 30;

const appState = {
  data: null,
  localEvents: [],
  pollingTimer: null,
  loadingAction: false
};

const elements = {
  refreshButton: document.querySelector("#refreshButton"),
  sendNowHeaderButton: document.querySelector("#sendNowHeaderButton"),
  simulatorMode: document.querySelector("#simulatorMode"),
  autoState: document.querySelector("#autoState"),
  backendTarget: document.querySelector("#backendTarget"),
  telemetryEndpoint: document.querySelector("#telemetryEndpoint"),
  backendConnection: document.querySelector("#backendConnection"),
  lastTelemetry: document.querySelector("#lastTelemetry"),
  tickInterval: document.querySelector("#tickInterval"),
  heartbeatInterval: document.querySelector("#heartbeatInterval"),
  dryRun: document.querySelector("#dryRun"),
  errorNotice: document.querySelector("#errorNotice"),
  officePower: document.querySelector("#officePower"),
  officePowerMeter: document.querySelector("#officePowerMeter"),
  devicesOnCount: document.querySelector("#devicesOnCount"),
  roomNodeCount: document.querySelector("#roomNodeCount"),
  roomSummaryGrid: document.querySelector("#roomSummaryGrid"),
  nodeSendGrid: document.querySelector("#nodeSendGrid"),
  roomsGrid: document.querySelector("#roomsGrid"),
  telemetryCards: document.querySelector("#telemetryCards"),
  eventList: document.querySelector("#eventList"),
  eventCount: document.querySelector("#eventCount"),
  roomTemplate: document.querySelector("#roomCardTemplate"),
  deviceTemplate: document.querySelector("#deviceCardTemplate")
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  void refreshState({ silent: false });
});

function bindEvents() {
  elements.refreshButton.addEventListener("click", () => {
    addLocalEvent("manual-control", "Manual refresh requested");
    void refreshState({ silent: false });
  });

  elements.sendNowHeaderButton.addEventListener("click", () => {
    void postAction("/telemetry/send-all-now", {
      label: "Send all ESP32 node telemetry now"
    });
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    const directPost = button.dataset.post;
    if (directPost) {
      void postAction(directPost, { label: button.textContent.trim() });
      return;
    }

    const roomAction = button.dataset.roomAction;
    if (roomAction) {
      const roomId = button.closest("[data-room-id]")?.dataset.roomId;
      const nodeId = button.closest("[data-node-id]")?.dataset.nodeId;
      if (nodeId) {
        const actionPath = roomAction === "send-now"
          ? `/nodes/${encodeURIComponent(nodeId)}/send-now`
          : `/nodes/${encodeURIComponent(nodeId)}/${roomAction}`;
        void postAction(actionPath, {
          label: `${nodeId} ${roomAction}`
        });
      } else if (roomId) {
        void postAction(`/rooms/${encodeURIComponent(roomId)}/${roomAction}`, {
          label: `${roomId} ${roomAction}`
        });
      }
      return;
    }

    const deviceAction = button.dataset.deviceAction;
    if (deviceAction) {
      const deviceId = button.closest("[data-device-id]")?.dataset.deviceId;
      if (deviceId) {
        void postAction(`/devices/${encodeURIComponent(deviceId)}/${deviceAction}`, {
          label: `${deviceId} ${deviceAction}`
        });
      }
      return;
    }

    const wattageAction = button.dataset.wattageAction;
    if (wattageAction) {
      const card = button.closest("[data-device-id]");
      if (card) {
        void submitWattage(card, wattageAction);
      }
    }
  });

  document.addEventListener("change", (event) => {
    const switchInput = event.target.closest("[data-device-switch]");
    if (!switchInput) {
      return;
    }

    const deviceId = switchInput.closest("[data-device-id]")?.dataset.deviceId;
    if (!deviceId) {
      return;
    }

    void postAction(`/devices/${encodeURIComponent(deviceId)}/state`, {
      method: "PATCH",
      label: `${deviceId} switch ${switchInput.checked ? "ON" : "OFF"}`,
      body: {
        status: switchInput.checked ? "on" : "off"
      }
    });
  });
}

async function refreshState({ silent }) {
  try {
    const response = await fetch("/state", {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`State request failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    appState.data = data;
    clearError();
    render(data);
    schedulePolling(data.runtime?.heartbeatIntervalMs || data.runtime?.tickIntervalMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(`Simulator state is unavailable. ${message}`);
    addLocalEvent("error", "State refresh failed", { message });
    if (!silent) {
      renderEmptyState();
    }
  }
}

async function postAction(path, options = {}) {
  const method = options.method || "POST";
  const label = options.label || path;
  setActionLoading(true);
  addLocalEvent("manual-control", `${label} requested`);

  try {
    const response = await fetch(path, {
      method,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || `Request failed with HTTP ${response.status}`);
    }

    if (payload.ok === false) {
      const resultSummary = summarizeSendResults(payload.results || [payload.result]);
      throw new Error(resultSummary || "The simulator reported that the action did not complete.");
    }

    clearError();
    addLocalEvent("manual-control", `${label} completed`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const friendly = path.startsWith("/telemetry")
      ? `Telemetry send failed. ${message}`
      : `${label} failed. ${message}`;
    showError(friendly);
    addLocalEvent("error", friendly);
  } finally {
    await refreshState({ silent: true });
    setActionLoading(false);
  }
}

async function submitWattage(card, action) {
  const deviceId = card.dataset.deviceId;
  const ratedInput = card.querySelector('[data-wattage-field="ratedPowerWatts"]');
  const customInput = card.querySelector('[data-wattage-field="customPowerWatts"]');
  const profileSelect = card.querySelector("[data-measurement-profile]");

  await postAction(`/devices/${encodeURIComponent(deviceId)}/rated-wattage`, {
    method: "PATCH",
    label: action === "reset" ? `${deviceId} rated wattage reset` : `${deviceId} rated wattage update`,
    body: action === "reset"
      ? { reset: true }
      : {
          ratedPowerWatts: Number(ratedInput.value)
        }
  });

  await postAction(`/devices/${encodeURIComponent(deviceId)}/custom-power`, {
    method: "PATCH",
    label: action === "reset" ? `${deviceId} custom power reset` : `${deviceId} custom power update`,
    body: {
      customPowerWatts: action === "reset" || customInput.value === "" ? null : Number(customInput.value)
    }
  });

  await postAction(`/devices/${encodeURIComponent(deviceId)}/measurement-profile`, {
    method: "PATCH",
    label: `${deviceId} measurement profile`,
    body: {
      measurementProfile: action === "reset" ? "rated" : profileSelect.value
    }
  });
}

function render(data) {
  if (!data) {
    renderEmptyState();
    return;
  }

  renderStatusBar(data);
  renderOverview(data);
  renderRoomSummaries(data.rooms);
  renderNodeSendControls(data.rooms, data.telemetry);
  renderRooms(data.rooms, data.telemetry);
  renderTelemetry(data);
  renderEvents(data.telemetry?.events || []);
}

function renderStatusBar(data) {
  const runtime = data.runtime || {};
  const telemetry = data.telemetry || {};
  const mode = runtime.mode || data.simulationMode || "manual";
  const autoPaused = Boolean(runtime.autoPaused ?? data.simulationPaused);
  const connection = telemetry.backendConnection || "idle";

  elements.simulatorMode.textContent = mode === "auto" ? "Auto Mode" : "Manual Mode";
  setStatusClass(elements.simulatorMode.parentElement, mode === "auto" ? "running" : "good");

  elements.autoState.textContent = mode === "auto" ? (autoPaused ? "Paused" : "Running") : "Disabled";
  setStatusClass(elements.autoState.parentElement, mode === "auto" && !autoPaused ? "running" : "warning");

  elements.backendTarget.textContent = runtime.backendTargetUrl || telemetry.backendTargetUrl || "-";
  elements.telemetryEndpoint.textContent = runtime.telemetryEndpoint || telemetry.telemetryEndpoint || "-";

  elements.backendConnection.textContent = formatConnection(connection);
  setStatusClass(
    elements.backendConnection.parentElement,
    connection === "ok" ? "good" : connection === "error" ? "error" : "warning"
  );

  elements.lastTelemetry.textContent = formatTimestamp(telemetry.lastTelemetrySentAt);
  elements.tickInterval.textContent = `${runtime.tickIntervalMs || telemetry.tickIntervalMs || 0} ms`;
  elements.heartbeatInterval.textContent = `${runtime.heartbeatIntervalMs || telemetry.heartbeatIntervalMs || 0} ms`;
  elements.dryRun.textContent = runtime.dryRun || telemetry.dryRun ? "Enabled" : "Disabled";
  setStatusClass(elements.dryRun.parentElement, runtime.dryRun || telemetry.dryRun ? "dry" : "good");
}

function renderOverview(data) {
  const officePower = Number(data.officePowerWatts || 0);
  const allDevices = flattenDevices(data.rooms);
  const onDevices = allDevices.filter((device) => device.status === "on");

  elements.officePower.textContent = String(officePower);
  elements.officePowerMeter.style.width = `${ratioPercent(officePower, OFFICE_MAX_POWER_WATTS)}%`;
  elements.devicesOnCount.textContent = `${onDevices.length} / ${allDevices.length}`;
  elements.roomNodeCount.textContent = `${(data.rooms || []).length} / 3`;
}

function renderRoomSummaries(rooms) {
  elements.roomSummaryGrid.replaceChildren();

  for (const room of rooms || []) {
    const summary = document.createElement("article");
    summary.className = "room-summary";

    const title = document.createElement("h3");
    title.textContent = room.roomName;

    const power = document.createElement("strong");
    power.textContent = `${room.roomPowerWatts}W`;

    const reference = document.createElement("span");
    reference.className = "label";
    reference.textContent = "Raw current draw preview";

    const meter = document.createElement("div");
    meter.className = "meter";
    const meterFill = document.createElement("span");
    meterFill.style.width = `${ratioPercent(room.roomPowerWatts, ROOM_MAX_POWER_WATTS)}%`;
    meter.append(meterFill);

    summary.append(title, power, reference, meter);
    elements.roomSummaryGrid.append(summary);
  }
}

function renderNodeSendControls(rooms, telemetry) {
  elements.nodeSendGrid.replaceChildren();

  const allCard = document.createElement("article");
  allCard.className = "node-send-card";
  const allTitle = document.createElement("h2");
  allTitle.textContent = "All ESP32 Nodes";
  const allMeta = document.createElement("p");
  const lastResults = telemetry?.lastResults || [];
  allMeta.textContent = lastResults.length
    ? `${lastResults.filter((result) => result.ok).length}/${lastResults.length} latest sends OK`
    : "Waiting for first send";
  const allButton = document.createElement("button");
  allButton.className = "button button-primary";
  allButton.type = "button";
  allButton.dataset.post = "/telemetry/send-all-now";
  allButton.textContent = "Send All";
  allCard.append(allTitle, allMeta, allButton);
  elements.nodeSendGrid.append(allCard);

  for (const room of rooms || []) {
    const result = telemetry?.lastResultByRoom?.[room.roomId];
    const payload = telemetry?.latestPayloadByRoom?.[room.roomId];
    const card = document.createElement("article");
    card.className = "node-send-card";
    card.dataset.nodeId = room.nodeId;

    const title = document.createElement("h2");
    title.textContent = room.nodeId;

    const meta = document.createElement("p");
    meta.textContent = result
      ? `${result.ok ? "OK" : "Error"} · seq ${result.sequence} · ${payload?.eventType || "manual_sync"}`
      : "Waiting for first send";

    const button = document.createElement("button");
    button.className = "button button-primary";
    button.type = "button";
    button.dataset.post = `/nodes/${encodeURIComponent(room.nodeId)}/send-now`;
    button.textContent = "Send Node";

    card.append(title, meta, button);
    elements.nodeSendGrid.append(card);
  }
}

function renderRooms(rooms, telemetry) {
  elements.roomsGrid.replaceChildren();

  for (const room of rooms || []) {
    const roomCard = elements.roomTemplate.content.firstElementChild.cloneNode(true);
    roomCard.dataset.roomId = room.roomId;
    roomCard.dataset.nodeId = room.nodeId;
    roomCard.querySelector("h2").textContent = room.roomName;
    roomCard.querySelector(".room-node").textContent = room.nodeId;
    roomCard.querySelector(".power-pill").textContent = `${room.roomPowerWatts}W / raw`;
    roomCard.querySelector(".meter span").style.width = `${ratioPercent(room.roomPowerWatts, ROOM_MAX_POWER_WATTS)}%`;

    const payload = telemetry?.latestPayloadByRoom?.[room.roomId];
    const result = telemetry?.lastResultByRoom?.[room.roomId];
    roomCard.querySelector(".node-telemetry").textContent = payload
      ? `Last ${payload.eventType} telemetry · seq ${payload.sequence} · ${result ? formatResult(result) : "pending"}`
      : "Waiting for first room-node telemetry";

    const devicesGrid = roomCard.querySelector(".devices-grid");
    for (const device of room.devices || []) {
      devicesGrid.append(renderDevice(device));
    }

    elements.roomsGrid.append(roomCard);
  }
}

function renderDevice(device) {
  const card = elements.deviceTemplate.content.firstElementChild.cloneNode(true);
  const isOn = device.status === "on";
  card.dataset.deviceId = device.id;
  card.dataset.type = device.type;
  card.classList.toggle("is-on", isOn);
  card.classList.toggle("is-off", !isOn);

  card.querySelector("h3").textContent = device.name;
  card.querySelector(".device-type").textContent = `${device.type} · ${device.id}`;

  const badge = card.querySelector(".status-badge");
  badge.textContent = device.status.toUpperCase();
  badge.classList.toggle("is-on", isOn);
  badge.classList.toggle("is-off", !isOn);

  const voltageVolts = isOn ? 220 : 0;
  const powerWatts = isOn ? Number(device.currentPowerWatts || 0) : 0;
  const currentAmps = voltageVolts > 0 ? Number((powerWatts / voltageVolts).toFixed(3)) : 0;

  card.querySelector('[data-field="powerWatts"]').textContent = `${powerWatts}W`;
  card.querySelector('[data-field="ratedPowerWatts"]').textContent = `${device.ratedPowerWatts}W`;
  card.querySelector('[data-field="voltageVolts"]').textContent = `${voltageVolts}V`;
  card.querySelector('[data-field="currentAmps"]').textContent = `${currentAmps}A`;
  card.querySelector('[data-field="measurementProfile"]').textContent = device.measurementProfile;
  card.querySelector('[data-field="allowedRange"]').textContent = `${device.minAllowedWatts}-${device.maxAllowedWatts}W`;

  const ratedInput = card.querySelector('[data-wattage-field="ratedPowerWatts"]');
  const customInput = card.querySelector('[data-wattage-field="customPowerWatts"]');
  const profileSelect = card.querySelector("[data-measurement-profile]");
  const switchInput = card.querySelector("[data-device-switch]");
  const switchLabel = card.querySelector(".switch-label");

  ratedInput.min = String(device.minAllowedWatts);
  ratedInput.max = String(device.maxAllowedWatts);
  ratedInput.value = String(device.ratedPowerWatts);
  customInput.min = String(device.minAllowedWatts);
  customInput.max = String(device.maxAllowedWatts);
  customInput.value = device.customPowerWatts === null ? "" : String(device.customPowerWatts);
  customInput.placeholder = `${device.ratedPowerWatts}W`;
  profileSelect.value = device.measurementProfile;
  switchInput.checked = isOn;
  switchInput.setAttribute("aria-label", `${isOn ? "Turn off" : "Turn on"} ${device.name}`);
  switchLabel.textContent = isOn ? "ON" : "OFF";

  return card;
}

function renderTelemetry(data) {
  const rooms = data?.rooms || [];
  const payloadByRoom = data?.telemetry?.latestPayloadByRoom || {};
  elements.telemetryCards.replaceChildren();

  for (const room of rooms) {
    const payload = payloadByRoom[room.roomId];
    const card = document.createElement("article");
    card.className = "telemetry-card";

    const heading = document.createElement("h3");
    heading.textContent = room.roomName;

    const meta = document.createElement("dl");
    meta.className = "telemetry-meta";
    meta.append(
      metaItem("Sequence", payload?.sequence ?? "-"),
      metaItem("Event", payload?.eventType ?? "-"),
      metaItem("Node", payload?.nodeId ?? room.nodeId),
      metaItem("Changed", payload?.changedDeviceIds?.length ? payload.changedDeviceIds.join(", ") : "None")
    );

    const json = document.createElement("pre");
    json.className = "json-panel";
    json.textContent = payload ? JSON.stringify(payload, null, 2) : "{}";

    card.append(heading, meta, json);
    elements.telemetryCards.append(card);
  }
}

function metaItem(term, value) {
  const wrapper = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = String(value);
  wrapper.append(dt, dd);
  return wrapper;
}

function renderEvents(serverEvents) {
  const mergedEvents = [...appState.localEvents, ...serverEvents]
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .slice(0, 50);

  elements.eventCount.textContent = `${mergedEvents.length} events`;
  elements.eventList.replaceChildren();

  for (const event of mergedEvents) {
    const item = document.createElement("li");
    item.dataset.type = event.type;

    const message = document.createElement("strong");
    message.textContent = event.message;

    const time = document.createElement("span");
    time.textContent = `${formatTimestamp(event.time)} · ${event.type}`;

    item.append(message, time);

    if (event.details) {
      const details = document.createElement("span");
      details.textContent = ` · ${compactDetails(event.details)}`;
      item.append(details);
    }

    elements.eventList.append(item);
  }
}

function renderEmptyState() {
  elements.simulatorMode.textContent = "Unavailable";
  elements.autoState.textContent = "-";
  elements.backendTarget.textContent = "-";
  elements.telemetryEndpoint.textContent = "-";
  elements.backendConnection.textContent = "Error";
  elements.lastTelemetry.textContent = "None";
  elements.tickInterval.textContent = "-";
  elements.heartbeatInterval.textContent = "-";
  elements.dryRun.textContent = "-";
  elements.officePower.textContent = "0";
  elements.officePowerMeter.style.width = "0%";
  elements.devicesOnCount.textContent = "0 / 15";
  elements.roomNodeCount.textContent = "0 / 3";
  elements.roomSummaryGrid.replaceChildren();
  elements.nodeSendGrid.replaceChildren();
  elements.roomsGrid.replaceChildren();
  elements.telemetryCards.replaceChildren();
  renderEvents([]);
}

function flattenDevices(rooms) {
  return (rooms || []).flatMap((room) => room.devices || []);
}

function schedulePolling(heartbeatIntervalMs) {
  const interval = Math.min(Math.max(Number(heartbeatIntervalMs) || 5000, 2000), 8000);
  if (appState.pollingTimer?.interval === interval) {
    return;
  }

  if (appState.pollingTimer) {
    clearInterval(appState.pollingTimer.id);
  }

  const id = setInterval(() => {
    if (!appState.loadingAction) {
      void refreshState({ silent: true });
    }
  }, interval);

  appState.pollingTimer = { id, interval };
}

function setActionLoading(isLoading) {
  appState.loadingAction = isLoading;
  for (const button of document.querySelectorAll("button")) {
    button.disabled = isLoading;
  }
}

function addLocalEvent(type, message, details) {
  appState.localEvents.unshift({
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    time: new Date().toISOString(),
    message,
    ...(details ? { details } : {})
  });

  if (appState.localEvents.length > MAX_LOCAL_EVENTS) {
    appState.localEvents.length = MAX_LOCAL_EVENTS;
  }

  if (appState.data) {
    renderEvents(appState.data.telemetry?.events || []);
  }
}

function showError(message) {
  elements.errorNotice.textContent = message;
  elements.errorNotice.classList.remove("hidden");
}

function clearError() {
  elements.errorNotice.textContent = "";
  elements.errorNotice.classList.add("hidden");
}

function ratioPercent(value, max) {
  if (!max) {
    return 0;
  }

  return Math.max(0, Math.min(100, (Number(value) / max) * 100));
}

function formatTimestamp(value) {
  if (!value) {
    return "None";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(parsed));
}

function formatConnection(connection) {
  const labels = {
    idle: "Idle",
    ok: "Connected",
    "dry-run": "Dry Run",
    error: "Error"
  };

  return labels[connection] || connection;
}

function formatResult(result) {
  if (result.dryRun) {
    return "dry run OK";
  }

  if (result.ok) {
    return result.status ? `HTTP ${result.status}` : "OK";
  }

  return result.error || result.statusText || `HTTP ${result.status || "error"}`;
}

function setStatusClass(element, status) {
  element.classList.remove("status-good", "status-running", "status-warning", "status-error", "status-dry");
  element.classList.add(`status-${status}`);
}

function summarizeSendResults(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return "";
  }

  const failed = results.filter((result) => result && !result.ok);
  if (failed.length === 0) {
    return "";
  }

  return failed
    .map((result) => `${result.nodeId}: ${result.error || result.statusText || `HTTP ${result.status || "unknown"}`}`)
    .join("; ");
}

function compactDetails(details) {
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
}
