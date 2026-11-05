import * as T from 'three';
import {trialCourses} from './trialCourses.ts';
import {TrialRun, formatTrialTime, formatTrialSplit, type TrialCourse, type TrialPose, type TrialVehicle} from './trialRules.ts';
import {TrialRecords} from './trialRecords.ts';
import {TrialAudio} from './trialAudio.ts';
import {trialDeviation} from './trialNavigation.ts';
import type {ParkMap, ParkTerrain} from './terrain.ts';
import './islandTrials.css';

type Hooks = {
  ready(): boolean;
  available(): boolean;
  running(): boolean;
  reducedMotion(): boolean;
  clear(): void;
  prepare(course: TrialCourse, signal: AbortSignal): Promise<boolean>;
  leave(): void;
};

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};
const button = (text: string, action: () => void, className = '') => {
  const element = node('button', className, text);
  element.type = 'button'; element.onclick = action;
  return element;
};
const seriesName = (vehicle: TrialVehicle) => vehicle === 'hoverbike' ? 'Sky Circuit' : 'One-Wheel Island Cup';
const distanceLabel = (distance: number) => distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`;
const spawnPose = (course: TrialCourse): TrialPose => ({...course.start, vehicle: course.vehicle, onFoot: false});
const signedAngle = (radians: number) => Math.atan2(Math.sin(radians), Math.cos(radians));

/** Solo time trials use the normal island cameras and vehicle controls. */
export class IslandTrials {
  readonly courses: TrialCourse[];
  private readonly records = new TrialRecords();
  private readonly audio: TrialAudio;
  private current?: TrialCourse;
  private run?: TrialRun;
  private actor?: TrialPose;
  private preparing = false;
  private generation = 0;
  private preparation?: AbortController;
  private skipNext = false;
  private lastRunning = false;
  private completed = false;
  private previousNext = -1;
  private previousStatus = '';
  private bestBefore: number | null = null;
  private selected: TrialVehicle = 'hoverbike';
  private lastUi = -Infinity;
  private unavailable = '';
  private readonly board = node('dialog');
  private readonly boardTitle = node('h2');
  private readonly boardIntro = node('p', 'trial-intro');
  private readonly boardFeedback = node('p', 'trial-board-feedback');
  private readonly boardContent = node('div', 'trial-course-grid');
  private readonly boardCurrent = node('div', 'trial-current');
  private readonly soundToggle = button('Gate sounds: off', () => { void this.audio.setEnabled(!this.audio.enabled); });
  private readonly soundStatus = node('p', 'trial-note');
  private readonly boardClose = button('Back to island', () => this.dismissBoard(), 'close');
  private readonly results = node('dialog');
  private readonly hud = node('section');
  private readonly hudSeries = node('span', 'trial-eyebrow');
  private readonly hudTitle = node('h3');
  private readonly hudTimer = node('output', 'trial-time', '0:00.00');
  private readonly hudStatus = node('span', 'trial-state');
  private readonly hudProgress = node('p', 'trial-progress');
  private readonly hudDirection = node('p', 'trial-direction');
  private readonly hudAltitude = node('p', 'trial-altitude');
  private readonly hudBest = node('p', 'trial-best');
  private readonly hudMap = node('canvas', 'trial-hud-map');
  private readonly live = node('p', 'trial-sr-only');
  private readonly notice = node('div');
  private noticeTimer = 0;
  private readonly launchers: HTMLButtonElement[] = [];
  private readonly world = new T.Group();
  private gateObjects: T.Group[] = [];
  private readonly mapBackgrounds = new Map<string, HTMLCanvasElement>();

  constructor(private scene: T.Scene, private data: ParkMap, private terrain: ParkTerrain, private canvas: HTMLCanvasElement, private hooks: Hooks) {
    this.audio = new TrialAudio({changed: () => this.refreshSound()});
    try { this.courses = trialCourses(data, terrain); }
    catch (error) { this.courses = []; this.unavailable = error instanceof Error ? error.message : 'Courses could not load.'; }
    this.world.name = 'Island trial route';
    this.world.userData.photoQuestIgnore = true;
    this.world.visible = false; scene.add(this.world);
    this.createBoard(); this.createHud();
    this.results.id = 'trial-results'; this.results.setAttribute('aria-labelledby', 'trial-results-title');
    this.results.addEventListener('cancel', event => { event.preventDefault(); this.interrupt(); });
    this.results.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.code === 'KeyR' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey) { event.preventDefault(); this.restart(); }
    });
    this.notice.id = 'trial-notice'; this.notice.hidden = true; this.notice.setAttribute('role', 'status');
    document.body.append(this.results, this.notice);
    const menuButton = button('Sky Circuit & Island Cup', () => this.open());
    menuButton.id = 'trials-open'; document.querySelector('#ride-menu nav')?.append(menuButton);
    this.launchers.push(menuButton);
    for (const vehicle of ['hoverbike', 'onewheel'] as const) {
      const launch = button(seriesName(vehicle), () => this.open(vehicle), 'trial-welcome');
      launch.disabled = true; document.querySelector('.cinema-actions')?.append(launch); this.launchers.push(launch);
    }
  }

  get active() { return !!this.current && (this.preparing || !!this.run); }
  get inputLocked() { return this.active && (this.preparing || this.skipNext || !this.lastRunning || this.run?.status !== 'running'); }
  // A fresh held control may be captured during countdown, but cannot move the vehicle yet.
  get inputCaptureLocked() { return this.active && (this.preparing || !this.run || this.run.status === 'finished' || this.run.status === 'invalid'); }
  get vehicle() { return this.current?.vehicle; }
  captureAudio() { return this.audio.capture(); }

  private refreshSound() {
    this.soundToggle.textContent = `Gate sounds: ${this.audio.enabled ? 'on' : 'off'}`;
    this.soundToggle.setAttribute('aria-pressed', String(this.audio.enabled));
    this.soundStatus.textContent = this.audio.status;
  }

  private createBoard() {
    this.board.id = 'trial-board'; this.board.setAttribute('aria-labelledby', 'trial-board-title');
    this.boardTitle.id = 'trial-board-title';
    this.boardFeedback.hidden = true; this.boardFeedback.setAttribute('role', 'status');
    const tabs = node('nav', 'trial-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Race series');
    for (const vehicle of ['hoverbike', 'onewheel'] as const) {
      const tab = button(seriesName(vehicle), () => { this.selected = vehicle; this.renderBoard(); });
      tab.id = `trial-tab-${vehicle}`; tab.dataset.vehicle = vehicle; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'trial-course-list'); tabs.append(tab);
    }
    tabs.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const choices = [...tabs.querySelectorAll<HTMLButtonElement>('button')];
      const index = choices.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + choices.length) % choices.length;
      choices[next].click(); choices[next].focus();
    });
    this.boardContent.id = 'trial-course-list'; this.boardContent.setAttribute('role', 'tabpanel');
    const sound = node('div', 'trial-sound-controls');
    this.soundToggle.id = 'trial-sound-toggle'; this.soundToggle.setAttribute('aria-describedby', 'trial-sound-status');
    this.soundStatus.id = 'trial-sound-status'; this.soundStatus.setAttribute('role', 'status');
    sound.append(this.soundToggle, this.soundStatus); this.refreshSound();
    this.board.append(this.boardClose, node('span', 'trial-eyebrow', 'DIGITAL STATIC / BELLE ISLE'), this.boardTitle, this.boardIntro, this.boardFeedback, this.boardCurrent, tabs, this.boardContent,
      sound, node('p', 'trial-note', 'Pass each numbered gate in order. The clock starts after the countdown. Menus and background tabs pause the run. R or Restart returns you to the start. Personal bests stay in this browser.'));
    this.board.addEventListener('cancel', event => { event.preventDefault(); this.dismissBoard(); });
    this.board.addEventListener('keydown', event => event.stopPropagation());
    document.body.append(this.board);
  }

  private dismissBoard() {
    if (!this.board.open) return;
    // A queued close event can arrive after the next run has captured fresh input.
    this.hooks.clear(); this.board.close(); this.canvas.focus();
  }

  private createHud() {
    this.hud.id = 'trial-hud'; this.hud.hidden = true; this.hud.setAttribute('aria-label', 'Current time trial');
    const summary = node('div', 'trial-hud-summary');
    const timing = node('div', 'trial-timing');
    this.hudTimer.setAttribute('aria-label', 'Elapsed time'); this.hudTimer.setAttribute('aria-live', 'off');
    timing.append(this.hudTimer, this.hudStatus);
    summary.append(this.hudSeries, this.hudTitle, timing, this.hudProgress, this.hudDirection, this.hudAltitude, this.hudBest);
    const map = node('figure', 'trial-map-wrap');
    this.hudMap.width = 360; this.hudMap.height = 200;
    this.hudMap.setAttribute('role', 'img'); this.hudMap.setAttribute('aria-label', 'Route map. The bright gate is next; the white arrow is your rider.');
    map.append(this.hudMap, node('figcaption', '', 'YOUR ROUTE · NEXT GATE IN GOLD'));
    const actions = node('div', 'trial-hud-actions');
    const restart = button('Restart · R', () => this.restart(), 'trial-primary'); restart.id = 'trial-restart';
    const exit = button('Leave race', () => this.interrupt()); exit.id = 'trial-exit';
    actions.append(restart, exit);
    this.live.setAttribute('role', 'status'); this.live.setAttribute('aria-live', 'polite'); this.live.setAttribute('aria-atomic', 'true');
    this.hud.append(summary, map, actions, this.live); document.body.append(this.hud);
  }

  open(vehicle?: TrialVehicle) {
    if (!this.hooks.ready() || (!this.active && !this.hooks.available())) { this.toast('Return to exploration to choose a course.'); return; }
    this.hooks.clear();
    document.querySelector<HTMLDialogElement>('#ride-menu[open]')?.close();
    if (this.results.open) this.results.close();
    if (vehicle) this.selected = vehicle;
    this.renderBoard(); if (!this.board.open) this.board.showModal();
  }

  private renderBoard() {
    this.boardTitle.textContent = this.selected === 'hoverbike' ? 'The island. A little higher.' : 'One wheel. One clean run.';
    this.boardIntro.textContent = this.selected === 'hoverbike'
      ? 'Launch into two dedicated hoverbike courses. Read the rings, hold your altitude, and chase a separate best time on each route.'
      : 'A short checkpoint race built for the feel of the ride. Follow the arches, find a smooth line, then restart and improve your time.';
    this.boardClose.textContent = this.active ? 'Back to race' : 'Back to island';
    for (const tab of this.board.querySelectorAll<HTMLButtonElement>('[data-vehicle]')) {
      const selected = tab.dataset.vehicle === this.selected; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    }
    this.boardContent.setAttribute('aria-labelledby', `trial-tab-${this.selected}`);
    this.boardCurrent.hidden = !this.active;
    if (this.current) this.boardCurrent.replaceChildren(node('span', '', `Current course: ${this.current.name}`), button('Leave race', () => { this.interrupt(); this.open(this.selected); }));
    this.boardContent.replaceChildren();
    const courses = this.courses.filter(course => course.vehicle === this.selected);
    for (const course of courses) {
      const card = node('article', 'trial-course'); card.style.setProperty('--trial-course-color', course.color);
      const preview = node('canvas', 'trial-course-map'); preview.width = 640; preview.height = 240;
      preview.setAttribute('role', 'img'); preview.setAttribute('aria-label', `${course.name}: ${distanceLabel(course.distance)}, ${course.gates.length} ordered checkpoints.`);
      this.drawCourseMap(preview, course);
      const content = node('div', 'trial-course-content');
      const metrics = node('p', 'trial-course-meta', `${distanceLabel(course.distance)} / ${course.gates.length} GATES / ${course.vehicle === 'hoverbike' ? 'DRONE FLIGHT' : 'ONE WHEEL'}`);
      const best = this.records.best(course);
      const record = node('p', 'trial-course-record'); record.append(node('span', '', 'PERSONAL BEST'), node('strong', '', best === null ? 'Set the first time' : formatTrialTime(best)));
      const controls = course.vehicle === 'hoverbike'
        ? 'W/S forward · A/D strafe · ←/→ turn · E/Q altitude · Shift boost · Space brake'
        : 'WASD or arrows to ride · Space to hop · R to restart';
      const start = button(this.current?.id === course.id ? 'Restart course' : 'Ride this course', () => { void this.begin(course); }, 'trial-primary');
      start.dataset.course = course.id;
      content.append(metrics, node('h3', '', course.name), node('p', 'trial-course-description', course.description), record, node('p', 'trial-course-controls', controls), start);
      card.append(preview, content); this.boardContent.append(card);
    }
    if (!courses.length) this.boardContent.append(node('p', 'trial-intro', this.unavailable || 'These courses are not available yet.'));
    if (!this.records.available) this.boardContent.append(node('p', 'trial-note', 'Browser storage is unavailable. Your best times will last for this visit.'));
  }

  private async begin(course: TrialCourse) {
    if (!this.hooks.ready() || (!this.active && !this.hooks.available())) { this.toast('Return to exploration before starting a course.'); return; }
    this.audio.silence();
    if (course.vehicle === 'hoverbike') void this.audio.unlock();
    this.preparation?.abort();
    clearTimeout(this.noticeTimer); this.notice.hidden = true;
    this.boardFeedback.hidden = true;
    const generation = ++this.generation, preparation = new AbortController(); this.preparation = preparation;
    this.current = course; this.run = undefined; this.preparing = true; this.completed = false; this.skipNext = true; this.lastRunning = false;
    this.previousNext = -1; this.previousStatus = ''; this.bestBefore = this.records.best(course);
    this.lastUi = -Infinity; this.hud.dataset.offCourse = 'false';
    this.live.textContent = `Preparing ${course.name}. The clock starts after your ride is ready.`;
    this.actor = spawnPose(course);
    if (this.board.open) this.board.close(); if (this.results.open) this.results.close();
    document.querySelector<HTMLDialogElement>('#ride-menu[open]')?.close();
    document.body.classList.add('island-trial'); document.body.dataset.trialVehicle = course.vehicle;
    this.hooks.clear(); this.buildRoute(course); this.world.visible = false;
    this.refreshHud();
    try {
      const ready = await this.hooks.prepare(course, preparation.signal);
      if (preparation.signal.aborted || generation !== this.generation) return;
      if (!ready) { this.failedStart(course.vehicle); return; }
      this.run = new TrialRun(course); this.run.restart(spawnPose(course)); this.preparing = false;
      this.world.visible = true; this.syncGates(); this.refreshHud(); this.canvas.focus();
      this.live.textContent = `${course.name}. Get ready. Pass all ${course.gates.length} gates in order.`;
    } catch (error) {
      if (preparation.signal.aborted || generation !== this.generation) return;
      console.warn('Island trial preparation failed', error);
      this.failedStart(course.vehicle);
    }
  }

  private failedStart(vehicle: TrialVehicle) {
    this.interrupt(); this.open(vehicle);
    const message = 'Your ride could not get ready. Choose the course to try again.';
    if (this.board.open) { this.boardFeedback.textContent = message; this.boardFeedback.hidden = false; }
    else this.toast(message);
  }

  restart() { if (this.current) void this.begin(this.current); }

  key(event: KeyboardEvent) {
    if (!this.active || event.ctrlKey || event.altKey || event.metaKey) return false;
    if (event.code === 'KeyR') { event.preventDefault(); if (!event.repeat) this.restart(); return true; }
    const locked = ['KeyF', 'KeyB', 'KeyG', 'KeyP', 'KeyJ'].includes(event.code) || (event.code === 'KeyE' && this.vehicle === 'onewheel');
    if (!locked) return false;
    event.preventDefault();
    if (!event.repeat) this.toast('Stay on your race vehicle. Use Restart for a fresh run or Leave race to explore.');
    return true;
  }

  /** Focus and menu changes discard one interval while movement is held. Never calls clear(). */
  suspend(actor?: TrialPose) {
    this.audio.silence();
    if (!this.active) return;
    if (actor) this.actor = {...actor};
    this.skipNext = true; this.lastRunning = false;
    if (this.run && this.actor) this.run.suspend(this.actor);
  }

  update(seconds: number, actor: TrialPose, now: number) {
    this.actor = {...actor};
    this.launchers.forEach(launch => { launch.disabled = !this.hooks.ready(); });
    if (!this.active) return;
    if (this.run) {
      const allowed = this.hooks.running();
      const previousGate = this.run.next;
      if (!allowed && this.lastRunning && this.run.status !== 'finished') this.audio.silence();
      if (this.skipNext || !allowed || !this.lastRunning) { this.run.suspend(actor); this.skipNext = false; }
      else this.run.step(seconds, actor, true);
      this.lastRunning = allowed;
      if (this.run.next !== this.previousNext || this.run.status !== this.previousStatus) {
        this.syncGates(); this.previousNext = this.run.next; this.previousStatus = this.run.status;
        if (this.run.status === 'running') this.live.textContent = this.run.next === 0 ? 'Go! Ride through gate 1.' : `Checkpoint ${this.run.next} cleared. ${this.current!.gates.length - this.run.next} to go.`;
      }
      if (!this.completed && (this.run.status === 'finished' || this.run.status === 'invalid')) { this.completed = true; this.showResults(); }
      // Results clear input before the final chime. Opening the results must not cut it off.
      if (allowed && this.current?.vehicle === 'hoverbike' && this.run.next > previousGate) this.audio.checkpoint(this.run.status === 'finished');
    }
    if (now - this.lastUi >= 80 || this.preparing) { this.lastUi = now; this.refreshHud(); }
  }

  interrupt(message = '') {
    const wasActive = this.active, hadDialog = this.board.open || this.results.open;
    this.audio.silence();
    this.preparation?.abort(); this.preparation = undefined; this.generation++;
    this.current = undefined; this.run = undefined; this.preparing = false; this.skipNext = false; this.lastRunning = false; this.completed = false;
    this.hud.hidden = true; this.world.visible = false; this.clearRoute();
    this.hud.dataset.offCourse = 'false';
    document.body.classList.remove('island-trial'); delete document.body.dataset.trialVehicle;
    if (wasActive || hadDialog) this.hooks.clear();
    if (this.board.open) this.board.close(); if (this.results.open) this.results.close();
    if (wasActive) this.hooks.leave();
    else if (hadDialog) this.canvas.focus();
    if (message) this.toast(message);
  }

  private refreshHud() {
    const course = this.current; this.hud.hidden = !this.active;
    if (!course) return;
    const run = this.run, paused = !this.preparing && !this.hooks.running();
    this.hud.dataset.status = this.preparing ? 'preparing' : run?.status ?? 'idle';
    this.hud.dataset.reducedMotion = String(this.hooks.reducedMotion());
    this.hud.dataset.next = String(run?.next ?? 0); this.hud.dataset.elapsed = String(run?.finish ?? run?.elapsed ?? 0); this.hud.dataset.course = course.id;
    this.hudSeries.textContent = seriesName(course.vehicle).toUpperCase(); this.hudTitle.textContent = course.name;
    this.hudTimer.textContent = formatTrialTime(run?.finish ?? run?.elapsed ?? 0);
    this.hudStatus.textContent = this.preparing ? 'GETTING READY' : paused && run?.status !== 'finished' && run?.status !== 'invalid' ? 'PAUSED' : run?.status === 'countdown' ? `${Math.max(1, Math.ceil(run.countdown))} · GET READY` : run?.status === 'finished' ? 'FINISHED' : run?.status === 'invalid' ? 'RUN ENDED' : 'RACING';
    const next = run?.next ?? 0;
    this.hudProgress.textContent = run?.status === 'finished' ? `${course.gates.length} / ${course.gates.length} checkpoints` : `Gate ${Math.min(next + 1, course.gates.length)} / ${course.gates.length}`;
    const target = course.gates[Math.min(next, course.gates.length - 1)], actor = this.actor ?? spawnPose(course);
    const wasOffCourse = this.hud.dataset.offCourse === 'true';
    const offCourse = run?.status === 'running' && trialDeviation(course, actor, wasOffCourse).offCourse;
    this.hud.dataset.offCourse = String(!!offCourse);
    if (target) {
      const dx = target.x - actor.x, dz = target.z - actor.z, distance = Math.hypot(dx, dz);
      const bearing = signedAngle(Math.atan2(dx, dz) - actor.heading);
      const direction = Math.abs(bearing) < .35 ? '↑ Ahead' : Math.abs(bearing) > 2.3 ? '↶ Turn around' : bearing < 0 ? '↗ Right' : '↖ Left';
      this.hudDirection.textContent = `${offCourse ? 'Off course · ' : ''}${direction} · ${Math.round(distance)} m to ${next === course.gates.length - 1 ? 'finish' : 'next gate'}`;
      if (course.vehicle === 'hoverbike') {
        const difference = target.y - actor.y;
        this.hudAltitude.textContent = Math.abs(difference) < Math.min(2, target.halfHeight * .5) ? 'Altitude on line · fly through the ring' : `${difference > 0 ? '↑ Climb' : '↓ Descend'} ${Math.ceil(Math.abs(difference))} m · ${difference > 0 ? 'E / UP' : 'Q / DOWN'}`;
      } else this.hudAltitude.textContent = 'Ride through the numbered arches in order';
    }
    if (offCourse !== wasOffCourse && run?.status === 'running') this.live.textContent = offCourse
      ? `Off course. Follow the route map and direction to gate ${next + 1}.`
      : `Back on course. Continue to gate ${next + 1}.`;
    if (run?.status === 'invalid') this.hudDirection.textContent = run.reason || 'Restart to begin a fresh timed run.';
    const best = this.records.best(course); this.hudBest.textContent = best === null ? 'PERSONAL BEST —' : `PERSONAL BEST ${formatTrialTime(best)}`;
    this.hud.dataset.paused = String(paused); this.hud.dataset.vehicle = course.vehicle;
    this.drawCourseMap(this.hudMap, course, actor, next);
  }

  private showResults() {
    const course = this.current, run = this.run; if (!course || !run) return;
    this.hooks.clear();
    const valid = run.status === 'finished' && run.finish !== null;
    const saved = valid ? this.records.save(course, run.finish!, run.splits) : undefined;
    const title = node('h2', '', valid ? saved?.improved ? 'Your new personal best.' : 'That’s a clean finish.' : 'Ready for another run?'); title.id = 'trial-results-title';
    const detail = valid ? `${course.name} · ${course.gates.length} checkpoints cleared.` : run.reason || 'The run ended before the finish. Restart to set a time.';
    const score = node('p', 'trial-result-time', valid ? formatTrialTime(run.finish) : 'RUN ENDED');
    const comparison = valid && this.bestBefore !== null ? `${formatTrialSplit(run.finish! - this.bestBefore)} against your previous best of ${formatTrialTime(this.bestBefore)}.` : valid ? 'First finish on this course. Your next run has a time to beat.' : 'This attempt did not change your personal best.';
    const actions = node('div', 'trial-result-actions');
    const replay = button('Race again · R', () => this.restart(), 'trial-primary'); replay.autofocus = true;
    actions.append(replay, button('Choose course', () => this.open(course.vehicle)), button('Keep exploring', () => this.interrupt()));
    this.results.replaceChildren(node('span', 'trial-eyebrow', seriesName(course.vehicle).toUpperCase()), title, score, node('p', 'trial-result-detail', detail), node('p', 'trial-result-comparison', comparison));
    if (valid && run.splits.length) {
      const details = node('details', 'trial-splits'); details.append(node('summary', '', 'Checkpoint splits'));
      const list = node('ol');
      run.splits.forEach((time, index) => {
        const row = node('li'); row.append(node('span', '', index === course.gates.length - 1 ? 'Finish' : `Gate ${index + 1}`), node('time', '', formatTrialTime(time))); list.append(row);
      });
      details.append(list); this.results.append(details);
    }
    if (valid && !saved?.saved) this.results.append(node('p', 'trial-note', 'Browser storage is unavailable. This best time is saved for the current visit only.'));
    this.results.append(actions);
    this.live.textContent = valid ? `Finished in ${formatTrialTime(run.finish)}. ${saved?.improved ? 'New personal best.' : ''}` : detail;
    if (!this.results.open) this.results.showModal();
    this.refreshHud();
  }

  private toast(text: string) {
    clearTimeout(this.noticeTimer); this.notice.textContent = text; this.notice.hidden = false;
    this.noticeTimer = window.setTimeout(() => { this.notice.hidden = true; }, 4500);
  }

  private clearRoute() {
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
    this.world.traverse(object => {
      if ('geometry' in object && object.geometry instanceof T.BufferGeometry) geometries.add(object.geometry);
      if ('material' in object) for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material instanceof T.Material) {
        materials.add(material); if ('map' in material && material.map instanceof T.Texture) textures.add(material.map);
      }
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
    this.world.clear(); this.gateObjects = [];
  }

  private buildRoute(course: TrialCourse) {
    this.clearRoute();
    const path = course.path.map(point => new T.Vector3(point.x, point.y + (course.vehicle === 'onewheel' ? .12 : 0), point.z));
    if (path.length > 1) {
      const line = new T.Line(new T.BufferGeometry().setFromPoints(path), new T.LineDashedMaterial({color: course.color, transparent: true, opacity: .45, dashSize: course.vehicle === 'hoverbike' ? 5 : 2.5, gapSize: course.vehicle === 'hoverbike' ? 5 : 2.5, depthWrite: false}));
      line.computeLineDistances(); this.world.add(line);
    }
    for (const [index, gate] of course.gates.entries()) {
      const group = new T.Group(); group.position.set(gate.x, gate.y, gate.z); group.rotation.y = gate.heading;
      const ground = course.vehicle === 'onewheel', height = ground ? Math.max(2.8, gate.halfHeight) : gate.halfHeight;
      const ring = new T.Mesh(new T.TorusGeometry(gate.radius, ground ? .10 : .18, 6, ground ? 28 : 40, ground ? Math.PI : Math.PI * 2), new T.MeshBasicMaterial({color: index === course.gates.length - 1 ? '#f5d38d' : course.color, transparent: true, opacity: .9, depthWrite: false}));
      ring.scale.y = height / gate.radius; if (ground) ring.position.y = .10;
      group.add(ring);
      const label = document.createElement('canvas'); label.width = 256; label.height = 120;
      const ctx = label.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#092329e6'; ctx.fillRect(0, 0, 256, 120); ctx.strokeStyle = index === course.gates.length - 1 ? '#f5d38d' : course.color; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 250, 114);
        ctx.fillStyle = '#f5eddb'; ctx.textAlign = 'center'; ctx.font = 'bold 58px system-ui'; ctx.fillText(String(index + 1).padStart(2, '0'), 128, 65);
        ctx.font = '17px system-ui'; ctx.fillText(index === course.gates.length - 1 ? 'FINISH' : 'CHECKPOINT', 128, 100);
        const texture = new T.CanvasTexture(label); texture.colorSpace = T.SRGBColorSpace;
        const sprite = new T.Sprite(new T.SpriteMaterial({map: texture, transparent: true, depthWrite: false}));
        const width = ground ? 2.6 : 5; sprite.scale.set(width, width * 120 / 256, 1); sprite.position.y = height + (ground ? .85 : 1.5); group.add(sprite);
      }
      this.gateObjects.push(group); this.world.add(group);
    }
  }

  private syncGates() {
    const next = this.run?.next ?? 0;
    this.gateObjects.forEach((group, index) => {
      group.visible = index >= next && index <= next + 2;
      group.traverse(object => {
        if ('material' in object && object.material instanceof T.Material) object.material.opacity = index === next ? 1 : index === next + 1 ? .42 : .22;
      });
    });
  }

  private mapFrame(course: TrialCourse, width: number, height: number) {
    const points = [course.start, ...course.path, ...course.gates];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const point of points) { minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minZ = Math.min(minZ, point.z); maxZ = Math.max(maxZ, point.z); }
    const rangeX = Math.max(90, maxX - minX), rangeZ = Math.max(90, maxZ - minZ);
    const scale = Math.min((width - 54) / rangeX, (height - 42) / rangeZ) * .92;
    return {px: (x: number) => width / 2 + (x - (minX + maxX) / 2) * scale, pz: (z: number) => height / 2 + (z - (minZ + maxZ) / 2) * scale};
  }

  private mapBackground(course: TrialCourse, width: number, height: number) {
    const key = `${course.id}:${width}:${height}`, cached = this.mapBackgrounds.get(key); if (cached) return cached;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) return canvas;
    const {px, pz} = this.mapFrame(course, width, height);
    context.fillStyle = '#0b2932'; context.fillRect(0, 0, width, height);
    const polygon = (points: [number, number][], color: string) => {
      context.beginPath(); points.forEach(([x, z], index) => index ? context.lineTo(px(x), pz(z)) : context.moveTo(px(x), pz(z))); context.closePath(); context.fillStyle = color; context.fill();
    };
    polygon(this.data.mainland, '#334d43'); polygon(this.data.island, '#334d43');
    for (const island of this.data.outerIslets ?? []) polygon(island.points, '#334d43');
    for (const water of this.data.water) { polygon(water.points, '#0b2932'); for (const hole of water.holes) polygon(hole, '#334d43'); }
    context.strokeStyle = '#8faaa04f'; context.lineWidth = 1;
    for (const road of this.data.roads) {
      if (road.foot) continue;
      context.beginPath(); road.points.forEach(([x, z], index) => index ? context.lineTo(px(x), pz(z)) : context.moveTo(px(x), pz(z))); context.stroke();
    }
    context.lineJoin = 'round'; context.lineCap = 'round'; context.strokeStyle = '#061c23'; context.lineWidth = 7;
    context.beginPath(); course.path.forEach((point, index) => index ? context.lineTo(px(point.x), pz(point.z)) : context.moveTo(px(point.x), pz(point.z))); context.stroke();
    context.strokeStyle = course.color; context.lineWidth = 3; context.stroke();
    for (const [index, gate] of course.gates.entries()) {
      context.fillStyle = '#e5e9d7'; context.beginPath(); context.arc(px(gate.x), pz(gate.z), index === course.gates.length - 1 ? 4 : 2.2, 0, Math.PI * 2); context.fill();
      if (index > 0 && index < course.gates.length - 1 && index % 3 === 0) {
        context.save(); context.translate(px(gate.x), pz(gate.z)); context.rotate(-gate.heading); context.fillStyle = course.color;
        context.beginPath(); context.moveTo(0, 6); context.lineTo(-3, -3); context.lineTo(3, -3); context.closePath(); context.fill(); context.restore();
      }
    }
    context.fillStyle = '#f5d38d'; context.fillRect(px(course.start.x) - 3, pz(course.start.z) - 3, 6, 6);
    context.font = 'bold 11px system-ui'; context.fillStyle = '#dce9df'; context.fillText('N ↑', 12, 19);
    this.mapBackgrounds.set(key, canvas); return canvas;
  }

  private drawCourseMap(canvas: HTMLCanvasElement, course: TrialCourse, actor?: TrialPose, next?: number) {
    const context = canvas.getContext('2d'); if (!context) return;
    const {width, height} = canvas, {px, pz} = this.mapFrame(course, width, height);
    context.clearRect(0, 0, width, height); context.drawImage(this.mapBackground(course, width, height), 0, 0);
    if (next !== undefined && course.gates[next]) {
      const target = course.gates[next], x = px(target.x), z = pz(target.z);
      context.strokeStyle = '#f5d38d'; context.fillStyle = '#10252e'; context.lineWidth = 3; context.beginPath(); context.arc(x, z, 7, 0, Math.PI * 2); context.fill(); context.stroke();
    }
    if (actor) {
      const x = Math.max(9, Math.min(width - 9, px(actor.x))), z = Math.max(9, Math.min(height - 9, pz(actor.z)));
      context.save(); context.translate(x, z); context.rotate(-actor.heading); context.fillStyle = '#ffffff'; context.strokeStyle = '#071d23'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(0, 8); context.lineTo(-5, -5); context.lineTo(0, -3); context.lineTo(5, -5); context.closePath(); context.fill(); context.stroke(); context.restore();
    }
  }

  drawMap(context: CanvasRenderingContext2D, px: (x: number) => number, pz: (z: number) => number) {
    if (!this.active || !this.current) return;
    const course = this.current; context.save(); context.strokeStyle = course.color; context.lineWidth = 3;
    context.beginPath(); course.path.forEach((point, index) => index ? context.lineTo(px(point.x), pz(point.z)) : context.moveTo(px(point.x), pz(point.z))); context.stroke();
    const target = course.gates[this.run?.next ?? 0];
    if (target) { context.strokeStyle = '#f5d38d'; context.beginPath(); context.arc(px(target.x), pz(target.z), 5, 0, Math.PI * 2); context.stroke(); }
    context.restore();
  }
}
