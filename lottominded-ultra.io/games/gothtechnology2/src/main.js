import { FIGHTERS } from "./config/assets.js?v=galaxy-a16-performance-v1";
import { COMMAND_LISTS, GAME_MODES, ROSTER_IDS } from "./config/content.js?v=galaxy-a16-performance-v1";
import { GothTechnologyGame } from "./scenes/game.js?v=galaxy-a16-performance-v1";
import { PHASE } from "./config/constants.js?v=galaxy-a16-performance-v1";

const syncViewportHeight = () => {
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
};

syncViewportHeight();
window.addEventListener("resize", syncViewportHeight, { passive: true });
window.addEventListener("orientationchange", syncViewportHeight, { passive: true });
document.addEventListener("contextmenu", (event) => event.preventDefault());

const intro = document.getElementById("startupIntro");
const introVideo = document.getElementById("startupVideo");
const introStart = document.getElementById("introStart");
const introSkip = document.getElementById("introSkip");
const shouldShowIntro = new URLSearchParams(window.location.search).get("intro") === "1";
const closeIntro = () => {
  if (!intro) return;
  intro.hidden = true;
  if (introVideo instanceof HTMLVideoElement) {
    introVideo.pause();
    introVideo.removeAttribute("src");
    introVideo.removeAttribute("poster");
    introVideo.load();
  }
};

if (intro && introVideo instanceof HTMLVideoElement && introStart && introSkip && shouldShowIntro) {
  introVideo.src = introVideo.dataset.src || "";
  introVideo.poster = introVideo.dataset.poster || "";
  introVideo.preload = "metadata";
  introVideo.load();
  intro.hidden = false;
  let introStarted = false;
  let fallbackTimer = 0;
  const startIntro = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (introStarted) return;
    introStarted = true;
    intro.dataset.playing = "true";
    fallbackTimer = window.setTimeout(() => {
      if (introVideo.paused || introVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        closeIntro();
      }
    }, 1400);
    try {
      introVideo.muted = false;
      introVideo.currentTime = 0;
      await introVideo.play();
    } catch (error) {
      console.warn("[GOTHTECHNOLOGY] Startup intro could not play", error);
      closeIntro();
    }
  };
  introStart.addEventListener("pointerdown", startIntro, { passive: false });
  introStart.addEventListener("touchstart", startIntro, { passive: false });
  introStart.addEventListener("click", startIntro);
  introSkip.addEventListener("click", closeIntro);
  introSkip.addEventListener("pointerdown", closeIntro, { passive: false });
  introVideo.addEventListener("playing", () => window.clearTimeout(fallbackTimer));
  introVideo.addEventListener("ended", closeIntro);
  introVideo.addEventListener("error", () => {
    closeIntro();
  });
} else {
  closeIntro();
}

const canvas = document.getElementById("game");
if (window.__gothTechnologyGame?.stop) window.__gothTechnologyGame.stop();
const game = new GothTechnologyGame(canvas);
window.__gothTechnologyGame = game;
const gameStatus = document.getElementById("gameStatus");
const accessibleActions = document.getElementById("accessibleActions");
const commercialBreak = document.getElementById("commercialBreak");
const commercialVideo = document.getElementById("commercialVideo");
const commercialLabel = document.getElementById("commercialLabel");
const commercialSkip = document.getElementById("commercialSkip");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettings = document.getElementById("closeSettings");
const resetBindings = document.getElementById("resetBindings");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const keyBindings = document.getElementById("keyBindings");
const bindingStatus = document.getElementById("bindingStatus");
const controllerStatus = document.getElementById("controllerStatus");
const commandPanel = document.getElementById("commandPanel");
const commandIdentity = document.getElementById("commandIdentity");
const commandList = document.getElementById("commandList");
const closeCommands = document.getElementById("closeCommands");
const trainingPanel = document.getElementById("trainingPanel");
const closeTraining = document.getElementById("closeTraining");
const mobileCommands = document.getElementById("mobileCommands");
const mobileTrainingTools = document.getElementById("mobileTrainingTools");
const mobileUtilityToggle = document.getElementById("mobileUtilityToggle");
const mobileUtilityActions = document.getElementById("mobileUtilityActions");
const roundContinue = document.getElementById("roundContinue");
const replayImport = document.getElementById("replayImport");
const replayImportFile = document.getElementById("replayImportFile");
const resetTouchPositions = document.getElementById("resetTouchPositions");
const TOUCH_POSITIONS_KEY = "gothtechnology.touch.positions.v1";

const settingFields = {
  musicVolume: document.getElementById("musicVolume"),
  sfxVolume: document.getElementById("sfxVolume"),
  shake: document.getElementById("shakeAmount"),
  vibration: document.getElementById("vibrationToggle"),
  highContrast: document.getElementById("contrastToggle"),
  reduceFlash: document.getElementById("reduceFlash"),
  colorFilter: document.getElementById("colorFilter"),
  hudScale: document.getElementById("hudScale"),
  touchLayout: document.getElementById("touchLayout")
};

const trainingFields = {
  trainingGuardMode: document.getElementById("trainingGuard"),
  trainingCounterHit: document.getElementById("trainingCounter"),
  trainingWakeupAction: document.getElementById("trainingWakeup"),
  trainingThrowTech: document.getElementById("trainingThrowTech"),
  trainingInputDelayFrames: document.getElementById("trainingDelay"),
  trainingHitboxes: document.getElementById("trainingHitboxes"),
  showFrameData: document.getElementById("trainingFrameData")
};

let touchPositions = {};
try {
  touchPositions = JSON.parse(window.localStorage?.getItem(TOUCH_POSITIONS_KEY) || "{}") || {};
} catch {
  touchPositions = {};
}

const saveTouchPositions = () => {
  try {
    window.localStorage?.setItem(TOUCH_POSITIONS_KEY, JSON.stringify(touchPositions));
  } catch {
    // The layout remains movable for this session when storage is blocked.
  }
};

const touchZoneReflows = [];
const touchZoneResetters = [];
let touchZoneReflowFrame = 0;
const scheduleTouchZoneReflow = () => {
  window.cancelAnimationFrame(touchZoneReflowFrame);
  touchZoneReflowFrame = window.requestAnimationFrame(() => {
    touchZoneReflows.forEach((reflow) => reflow());
  });
};

const bindMovableZone = (zoneId, handleId) => {
  const zone = document.getElementById(zoneId);
  const handle = document.getElementById(handleId);
  if (!zone || !handle) return;
  const saved = touchPositions[zoneId] || {};
  let current = {
    x: Number.isFinite(Number(saved.x)) ? Number(saved.x) : 0,
    y: Number.isFinite(Number(saved.y)) ? Number(saved.y) : 0
  };
  const apply = () => {
    zone.style.setProperty("--zone-x", `${current.x}px`);
    zone.style.setProperty("--zone-y", `${current.y}px`);
  };
  const clampToViewport = (persist = false) => {
    const rect = zone.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const padding = 8;
    const base = {
      left: rect.left - current.x,
      right: rect.right - current.x,
      top: rect.top - current.y,
      bottom: rect.bottom - current.y
    };
    const minX = Math.max(-96, padding - base.left);
    const maxX = Math.min(96, window.innerWidth - padding - base.right);
    const minY = Math.max(-72, padding - base.top);
    const maxY = Math.min(72, window.innerHeight - padding - base.bottom);
    current = {
      x: minX <= maxX ? Math.max(minX, Math.min(maxX, current.x)) : 0,
      y: minY <= maxY ? Math.max(minY, Math.min(maxY, current.y)) : 0
    };
    apply();
    if (persist) {
      touchPositions[zoneId] = current;
      saveTouchPositions();
    }
  };
  apply();
  touchZoneReflows.push(clampToViewport);
  touchZoneResetters.push(() => {
    current = { x: 0, y: 0 };
    apply();
    clampToViewport();
  });
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    const start = { x: event.clientX, y: event.clientY, baseX: current.x, baseY: current.y };
    const move = (moveEvent) => {
      current = {
        x: Math.max(-96, Math.min(96, start.baseX + moveEvent.clientX - start.x)),
        y: Math.max(-72, Math.min(72, start.baseY + moveEvent.clientY - start.y))
      };
      apply();
      clampToViewport();
    };
    const finish = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      clampToViewport(true);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });
};

bindMovableZone("padZone", "movePad");
bindMovableZone("combatZone", "moveCombat");
scheduleTouchZoneReflow();
window.addEventListener("resize", scheduleTouchZoneReflow, { passive: true });
window.addEventListener("orientationchange", scheduleTouchZoneReflow, { passive: true });

const playerBindingGroups = [
  ["MOVEMENT", [
    ["MOVE LEFT", "left"],
    ["MOVE RIGHT", "right"],
    ["JUMP", "up"],
    ["CROUCH", "down"],
    ["DASH", "dash"]
  ]],
  ["ATTACKS & SKILLS", [
    ["LIGHT PUNCH", "lightPunch"],
    ["HEAVY PUNCH", "heavyPunch"],
    ["LIGHT KICK", "lightKick"],
    ["HEAVY KICK", "heavyKick"],
    ["SPECIAL", "special"],
    ["SUPER", "super"],
    ["THROW", "throw"],
    ["ASSIST 1", "assist1"],
    ["ASSIST 2", "assist2"],
    ["TAUNT", "taunt"]
  ]]
];

const systemBindingRows = [
  ["CONFIRM", "ui.confirm"],
  ["BACK", "ui.back"],
  ["PAUSE", "ui.pause"],
  ["CPU MODE", "ui.cpu"],
  ["TRAINING MODE", "ui.training"],
  ["FRAME DATA", "ui.frameData"],
  ["MUTE AUDIO", "ui.mute"],
  ["RESET ROUND", "ui.reset"],
  ["DUMMY CONTROL", "ui.dummy"],
  ["RECORD INPUT", "ui.record"],
  ["PLAY RECORDING", "ui.playback"]
];

const actionLabels = new Map([
  ...playerBindingGroups.flatMap(([, rows]) => rows.flatMap(([label, suffix]) => [
    [`p1.${suffix}`, `${label}, Player 1`],
    [`p2.${suffix}`, `${label}, Player 2`]
  ])),
  ...systemBindingRows.map(([label, action]) => [action, label])
]);

const KEY_LABELS = {
  Slash: "/",
  Period: ".",
  Semicolon: ";",
  Quote: "'",
  BracketRight: "]",
  BracketLeft: "[",
  Backslash: "\\",
  Comma: ",",
  Minus: "-",
  Equal: "="
};
const formatKey = (code) => KEY_LABELS[code] ?? String(code || "Unbound")
  .replace(/^Key/, "")
  .replace(/^Digit/, "")
  .replace(/^Numpad/, "NUM ")
  .replace("Arrow", "");

let listeningButton = null;
let settingsOpener = null;
let dialogOpener = null;
const setBindingStatus = (message) => {
  if (bindingStatus) bindingStatus.textContent = message;
  game.announce(message);
};

const makeBindingHeading = (label, system = false) => {
  const heading = document.createElement("div");
  heading.className = `binding-heading${system ? " binding-system-heading" : ""}`;
  heading.append(Object.assign(document.createElement("span"), { textContent: label }));
  heading.append(Object.assign(document.createElement("span"), { textContent: system ? "KEY" : "PLAYER 1" }));
  if (!system) heading.append(Object.assign(document.createElement("span"), { textContent: "PLAYER 2" }));
  return heading;
};

const makeBindingButton = (label, action, player = null) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "binding-button";
  button.dataset.action = action;
  button.textContent = formatKey(game.input.getBinding(action));
  button.setAttribute("aria-label", `${label}${player ? `, player ${player}` : ""}, ${button.textContent}`);
  button.addEventListener("click", () => beginBinding(button, action));
  return button;
};

const renderBindings = () => {
  if (!keyBindings) return;
  const content = [];
  for (const [groupLabel, rows] of playerBindingGroups) {
    content.push(makeBindingHeading(groupLabel));
    for (const [label, suffix] of rows) {
      const row = document.createElement("div");
      row.className = "binding-row";
      row.append(Object.assign(document.createElement("span"), { textContent: label }));
      for (const player of [1, 2]) row.append(makeBindingButton(label, `p${player}.${suffix}`, player));
      content.push(row);
    }
  }
  content.push(makeBindingHeading("SYSTEM & TRAINING", true));
  for (const [label, action] of systemBindingRows) {
    const row = document.createElement("div");
    row.className = "binding-row binding-system-row";
    row.append(Object.assign(document.createElement("span"), { textContent: label }));
    row.append(makeBindingButton(label, action));
    content.push(row);
  }
  keyBindings.replaceChildren(...content);
};

const cancelBinding = (restore = true) => {
  if (!listeningButton) return;
  const button = listeningButton;
  listeningButton.dataset.listening = "false";
  listeningButton = null;
  window.removeEventListener("keydown", captureBinding, true);
  if (restore && button.isConnected) {
    button.textContent = formatKey(game.input.getBinding(button.dataset.action));
    button.setAttribute("aria-label", `${actionLabels.get(button.dataset.action) || "ACTION"}, ${button.textContent}`);
  }
};

const captureBinding = (event) => {
  if (!listeningButton) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.repeat) return;
  const action = listeningButton.dataset.action;
  if (event.code === "Escape") {
    cancelBinding();
    setBindingStatus(`${actionLabels.get(action) || "Binding"} unchanged`);
    return;
  }
  if (["Backspace", "Delete"].includes(event.code)) {
    game.input.unbind(action);
    cancelBinding(false);
    renderBindings();
    setBindingStatus(`${actionLabels.get(action) || "Binding"} cleared`);
    return;
  }
  const previousCode = game.input.getBinding(action);
  const swappedAction = game.input.getActionForCode(event.code);
  game.input.rebind(action, event.code);
  cancelBinding(false);
  renderBindings();
  const swapMessage = swappedAction && swappedAction !== action
    ? `. ${actionLabels.get(swappedAction) || "Conflicting action"} moved to ${formatKey(previousCode)}`
    : "";
  setBindingStatus(`${actionLabels.get(action) || "Binding"} set to ${formatKey(event.code)}${swapMessage}`);
  keyBindings?.querySelector(`[data-action="${action}"]`)?.focus();
};

function beginBinding(button, action) {
  cancelBinding();
  listeningButton = button;
  button.dataset.action = action;
  button.dataset.listening = "true";
  button.textContent = "PRESS KEY";
  setBindingStatus(`Press a key for ${actionLabels.get(action) || "this action"}. Escape cancels. Backspace clears.`);
  window.addEventListener("keydown", captureBinding, true);
}

const updateControllerStatus = () => {
  if (!controllerStatus) return;
  const controllers = game.input.getGamepadStatus?.() || [];
  controllerStatus.textContent = controllers.length === 0
    ? "GAMEPADS: NONE CONNECTED"
    : controllers.map(({ player, id }) => `P${player}: ${id}`).join(" // ");
};

const openSettingsPanel = () => {
  if (!settingsPanel) return;
  settingsOpener = document.activeElement;
  renderBindings();
  if (bindingStatus) bindingStatus.textContent = "Changes save automatically. Select a key to remap it.";
  updateControllerStatus();
  for (const [key, field] of Object.entries(settingFields)) {
    if (!field) continue;
    if (field.type === "checkbox") field.checked = Boolean(game.settings[key]);
    else field.value = String(game.settings[key]);
  }
  settingsPanel.hidden = false;
  closeSettings?.focus();
};

const closeDialog = (panel, announce) => {
  if (panel) panel.hidden = true;
  const restoreTarget = dialogOpener instanceof HTMLElement && dialogOpener.isConnected ? dialogOpener : canvas;
  restoreTarget.focus();
  dialogOpener = null;
  game.announce(announce);
};

const openCommandPanel = (event) => {
  if (!commandPanel || !commandList) return;
  dialogOpener = document.activeElement;
  const characterId = event?.detail?.characterId || game.player1Id;
  const commandSet = COMMAND_LISTS[characterId] || COMMAND_LISTS.KALYX;
  const fighter = FIGHTERS[characterId];
  if (commandIdentity) commandIdentity.textContent = `${fighter?.name || characterId} / ${commandSet.title}. ${commandSet.passive}`;
  commandList.replaceChildren(...commandSet.commands.map((command) => {
    const row = document.createElement("div");
    row.className = "command-row";
    const input = document.createElement("span");
    input.className = "command-input";
    input.textContent = command.input;
    const name = document.createElement("span");
    name.className = "command-name";
    name.textContent = command.name;
    const detail = document.createElement("span");
    detail.textContent = command.detail;
    row.append(input, name, detail);
    return row;
  }));
  commandPanel.hidden = false;
  closeCommands?.focus();
};

const openTrainingPanel = () => {
  if (!trainingPanel || !game.training) return;
  dialogOpener = document.activeElement;
  for (const [key, field] of Object.entries(trainingFields)) {
    if (!field) continue;
    if (field.type === "checkbox") field.checked = Boolean(game[key]);
    else field.value = String(game[key]);
  }
  trainingPanel.hidden = false;
  closeTraining?.focus();
};

const closeSettingsPanel = () => {
  cancelBinding();
  window.removeEventListener("keydown", captureBinding, true);
  if (settingsPanel) settingsPanel.hidden = true;
  const restoreTarget = settingsOpener instanceof HTMLElement && settingsOpener.isConnected ? settingsOpener : canvas;
  restoreTarget.focus();
  settingsOpener = null;
  game.announce("Control settings closed");
};

const toggleMute = () => {
  game.audio.toggleMute();
  game.lastAccessibleState = "";
  game.announce(game.audio.muted ? "Audio muted" : "Audio active");
};

const actionButton = (label, handler) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
};

const renderAccessibleActions = (state) => {
  if (!accessibleActions) return;
  document.body.dataset.phase = state.phase;
  document.body.dataset.training = String(Boolean(state.training));
  document.body.dataset.highContrast = String(Boolean(game.settings.highContrast));
  document.body.dataset.touchLayout = game.settings.touchLayout || "classic";
  document.body.dataset.colorFilter = game.settings.colorFilter || "normal";
  scheduleTouchZoneReflow();
  if (roundContinue) {
    const canContinue = state.phase === PHASE.ROUND_END || state.phase === PHASE.MATCH_END;
    roundContinue.hidden = !canContinue;
    roundContinue.textContent = state.phase === PHASE.ROUND_END
      ? "NEXT ROUND"
      : (game.matchEndPrompt || "CONTINUE");
  }
  if (gameStatus) {
    const combat = state.phase === PHASE.FIGHT
      ? ` Player one health ${state.player1Health} percent, meter ${state.player1Meter}. Player two health ${state.player2Health} percent.`
      : "";
    gameStatus.textContent = `${state.phase}. ${state.player1Name} versus ${state.player2Name}.${combat}`;
  }
  const actions = [];
  if (state.phase === PHASE.TITLE) {
    actions.push(actionButton("Game select", () => game.openGameSelect()));
    for (const [mode, config] of Object.entries(GAME_MODES)) {
      actions.push(actionButton(config.label, () => game.openMode(mode)));
    }
    actions.push(actionButton(state.cpuEnabled ? `CPU ${state.cpuDifficulty}. Change opponent mode` : "Local two-player. Change opponent mode", () => game.cycleCpuMode()));
    actions.push(actionButton("Control settings", () => game.openSettings()));
  } else if (state.phase === PHASE.GAME_SELECT) {
    actions.push(actionButton("Play GOTHTECHNOLOGY", () => { game.selectGame(0); game.launchSelectedGame(); }));
    actions.push(actionButton("Play Robot Rahbe", () => { game.selectGame(1); game.launchSelectedGame(); }));
    actions.push(actionButton("Play 2084 Static WAV", () => { game.selectGame(2); game.launchSelectedGame(); }));
    actions.push(actionButton("Back", () => game.returnToTitle()));
  } else if (state.phase === PHASE.REPLAY_SELECT) {
    const replays = game.getReplayLibrary();
    replays.forEach((replay, index) => {
      const p1 = FIGHTERS[replay.player1Id]?.name || replay.player1Id || "Fighter";
      const p2 = FIGHTERS[replay.player2Id]?.name || replay.player2Id || "Fighter";
      actions.push(actionButton(`Play replay ${index + 1}: ${p1} versus ${p2}`, () => game.startReplay(index)));
    });
    if (replays.length) {
      actions.push(actionButton("Export selected replay", () => game.exportReplay(game.replaySlotIndex)));
      actions.push(actionButton("Delete selected replay", () => game.deleteReplay(game.replaySlotIndex)));
    }
    actions.push(actionButton("Import replay JSON", () => replayImportFile?.click()));
    actions.push(actionButton("Back", () => game.returnToTitle()));
  } else if (state.phase === PHASE.SELECT) {
    const opponentRole = state.training ? "training dummy" : (state.cpuEnabled ? "CPU opponent" : "Player 2");
    actions.push(actionButton("Select Player 1", () => game.setSelectionTarget("p1")));
    if (game.gameMode !== "arcade") actions.push(actionButton(`Select ${opponentRole}`, () => game.setSelectionTarget("p2")));
    const activeRole = state.selectTarget === "p2" ? opponentRole : "Player 1";
    for (const characterId of ROSTER_IDS) {
      actions.push(actionButton(`Choose ${FIGHTERS[characterId].name} for ${activeRole}`, () => game.chooseCharacter(characterId)));
    }
    actions.push(actionButton("Change stage", () => game.cycleStage()));
    actions.push(actionButton(`Start ${GAME_MODES[game.gameMode]?.label || "fight"}`, () => game.startVersus()));
    actions.push(actionButton("Back", () => game.returnToTitle()));
  } else if (state.phase === PHASE.FIGHT) {
    actions.push(actionButton("Pause", () => { game.phase = PHASE.PAUSE; game.announce("Game paused"); }));
    actions.push(actionButton("Command list", () => game.openCommands()));
    if (state.training) {
      actions.push(actionButton("Training tools", () => game.openTrainingTools()));
    }
    if (state.isReplay) actions.push(actionButton(`Replay speed ${state.replaySpeed} times`, () => game.cycleReplaySpeed()));
    actions.push(actionButton(state.muted ? "Unmute" : "Mute", toggleMute));
  } else if (state.phase === PHASE.PAUSE) {
    actions.push(actionButton("Resume", () => { game.phase = PHASE.FIGHT; game.announce("Fight resumed"); }));
    actions.push(actionButton("Control settings", () => game.openSettings()));
    actions.push(actionButton("Command list", () => game.openCommands()));
    if (state.training) actions.push(actionButton("Training tools", () => game.openTrainingTools()));
    if (state.isReplay) {
      actions.push(actionButton(`Replay speed ${state.replaySpeed} times`, () => game.cycleReplaySpeed()));
      actions.push(actionButton("Step one replay frame", () => game.stepReplayFrame()));
      actions.push(actionButton("Export this replay", () => game.exportReplay(game.replaySlotIndex)));
    }
    actions.push(actionButton("Restart match", () => game.startMatch(game.training)));
    actions.push(actionButton("Return to title", () => game.returnToTitle()));
    actions.push(actionButton(state.muted ? "Unmute" : "Mute", toggleMute));
  } else if (state.phase === PHASE.ROUND_END) {
    actions.push(actionButton("Next round", () => game.startRound()));
  } else if (state.phase === PHASE.MATCH_END) {
    actions.push(actionButton(game.matchEndPrompt || "Continue", () => game.advanceAfterMatch()));
  }
  accessibleActions.replaceChildren(...actions);
};

window.addEventListener("gothtechnology:state", (event) => renderAccessibleActions(event.detail));
window.addEventListener("gothtechnology:announce", (event) => {
  if (gameStatus) gameStatus.textContent = event.detail;
});
window.addEventListener("gothtechnology:settings", openSettingsPanel);
window.addEventListener("gothtechnology:commands", openCommandPanel);
window.addEventListener("gothtechnology:training-tools", openTrainingPanel);
window.addEventListener("gothtechnology:commercial", async (event) => {
  if (!(commercialVideo instanceof HTMLVideoElement) || !commercialBreak) {
    game.finishCommercialBreak();
    return;
  }
  commercialLabel.textContent = `ARCADE TRANSMISSION // LEVEL ${event.detail.nextLevel}`;
  commercialVideo.src = event.detail.url;
  commercialVideo.volume = game.settings.sfxVolume;
  commercialVideo.currentTime = 0;
  commercialBreak.hidden = false;
  commercialSkip?.focus();
  try {
    await commercialVideo.play();
  } catch (error) {
    console.warn("[GOTHTECHNOLOGY] Commercial could not play", error);
    game.finishCommercialBreak();
  }
});
window.addEventListener("gothtechnology:commercial-end", () => {
  if (commercialVideo instanceof HTMLVideoElement) {
    commercialVideo.pause();
    commercialVideo.removeAttribute("src");
    commercialVideo.load();
  }
  if (commercialBreak) commercialBreak.hidden = true;
  canvas.focus();
});
window.addEventListener("gothtechnology:keymap-changed", renderBindings);
window.addEventListener("gamepadconnected", updateControllerStatus);
window.addEventListener("gamepaddisconnected", updateControllerStatus);
closeSettings?.addEventListener("click", closeSettingsPanel);
closeCommands?.addEventListener("click", () => closeDialog(commandPanel, "Command list closed"));
closeTraining?.addEventListener("click", () => closeDialog(trainingPanel, "Training tools closed"));
const setMobileUtilityExpanded = (expanded) => {
  if (!mobileUtilityToggle || !mobileUtilityActions) return;
  mobileUtilityToggle.setAttribute("aria-expanded", String(expanded));
  mobileUtilityActions.hidden = !expanded;
};
mobileUtilityToggle?.addEventListener("click", () => {
  setMobileUtilityExpanded(mobileUtilityToggle.getAttribute("aria-expanded") !== "true");
});
roundContinue?.addEventListener("click", () => {
  if (game.phase === PHASE.ROUND_END) game.startRound();
  else if (game.phase === PHASE.MATCH_END) game.advanceAfterMatch();
  canvas.focus();
});
mobileCommands?.addEventListener("click", () => {
  setMobileUtilityExpanded(false);
  game.openCommands();
});
mobileTrainingTools?.addEventListener("click", () => {
  setMobileUtilityExpanded(false);
  game.openTrainingTools();
});
commercialSkip?.addEventListener("click", () => game.finishCommercialBreak());
commercialVideo?.addEventListener("ended", () => game.finishCommercialBreak());
commercialVideo?.addEventListener("error", () => game.finishCommercialBreak());
commercialBreak?.addEventListener("keydown", (event) => {
  if (["Escape", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    game.finishCommercialBreak();
  }
});

replayImport?.addEventListener("click", () => replayImportFile?.click());
replayImportFile?.addEventListener("change", async () => {
  const file = replayImportFile.files?.[0];
  replayImportFile.value = "";
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    game.importReplay(payload);
  } catch {
    game.announce("Replay import rejected: invalid JSON");
  }
});

for (const [key, field] of Object.entries(settingFields)) {
  field?.addEventListener("input", () => {
    const value = field.type === "checkbox" ? field.checked : field.type === "range" ? Number(field.value) : field.value;
    game.updateSettings({ [key]: value });
  });
}

for (const [key, field] of Object.entries(trainingFields)) {
  field?.addEventListener("input", () => {
    const value = field.type === "checkbox" ? field.checked : field.type === "range" ? Number(field.value) : field.value;
    game.updateTrainingSettings({ [key]: value });
  });
}

document.getElementById("trainingRecord")?.addEventListener("click", () => game.startTrainingRecording());
document.getElementById("trainingPlayback")?.addEventListener("click", () => game.startTrainingPlayback());
document.getElementById("trainingSave")?.addEventListener("click", () => game.saveTrainingRecording());
document.getElementById("trainingLoad")?.addEventListener("click", () => game.loadTrainingRecording());
document.getElementById("trainingReset")?.addEventListener("click", () => game.resetTrainingPosition());
resetBindings?.addEventListener("click", () => {
  game.input.resetBindings();
  renderBindings();
  setBindingStatus("Keyboard bindings reset to defaults");
});
resetTouchPositions?.addEventListener("click", () => {
  touchPositions = {};
  try {
    window.localStorage?.removeItem(TOUCH_POSITIONS_KEY);
  } catch {
    // The visible layout can still be reset for this session.
  }
  touchZoneResetters.forEach((reset) => reset());
  scheduleTouchZoneReflow();
  setBindingStatus("Touch controls reset to safe positions");
});
fullscreenToggle?.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    game.announce("Fullscreen is unavailable in this browser");
  }
});
settingsPanel?.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !listeningButton) {
    event.preventDefault();
    closeSettingsPanel();
    return;
  }
  if (event.key === "Tab") {
    const focusable = [...settingsPanel.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

const bindDialogKeyboard = (panel, close) => panel?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...panel.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")]
    .filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

bindDialogKeyboard(commandPanel, () => closeDialog(commandPanel, "Command list closed"));
bindDialogKeyboard(trainingPanel, () => closeDialog(trainingPanel, "Training tools closed"));
const unlockAudio = () => game.audio.ensure();
window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("touchstart", unlockAudio, { passive: true });
window.addEventListener("keydown", unlockAudio);
game.render();
game.boot().catch((error) => {
  console.error("[GOTHTECHNOLOGY] Boot failed", error);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#050403";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffd66d";
  ctx.font = "700 32px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("GOTHTECHNOLOGY asset boot failed", canvas.width / 2, canvas.height / 2);
});
