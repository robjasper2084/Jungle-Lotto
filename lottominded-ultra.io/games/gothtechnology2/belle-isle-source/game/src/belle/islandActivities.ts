import * as T from 'three';
import {createDispatchStops, registerPhotoSubjects, type PhotoSubjectRegistration as RegisteredPhotoSubject} from './activityCatalog.ts';
import {createDispatchContracts, startDispatch, advanceDispatchTime, getDispatchTargets, tryDispatchHandoff, claimDispatchCompletion, type DispatchContract, type DispatchState, type DispatchActor} from './dispatchRules.ts';
import {ACTIVITY_STORAGE_KEY, PHOTO_FRAMES, readActivityProfile, completeActivity, activityXp, activityTitle, type ActivityProfile} from './activityProgress.ts';
import {ActivityAlbum, albumImage, downloadAlbumPhoto, type AlbumPhoto} from './activityAlbum.ts';
import {evaluatePhotoSubject} from './photoQuestScene.ts';
import type {CameraCapture, PhotoCaptureFrame} from './cameraCapture.ts';
import type {ParkMap, ParkTerrain} from './terrain.ts';
import './islandActivities.css';

type ActivityTab = 'dispatch' | 'photo' | 'album';
type Actor = DispatchActor & {ride: 'onewheel' | 'hoverbike'; height: number};
type PhotoAssignment = {id: string; title: string; description: string; targets: string[]; count: number; xp: number; minCoverage: number; aerial: boolean};
type PhotoAttempt = {id: string; assignment: PhotoAssignment; accepted: Map<string, number>};
type Shot = {attemptId: string; assignmentId: string; subjectId: string; subjectName: string; score: number; valid: boolean; feedback: string};
type Hooks = {
  clear(): void;
  start(): void;
  ready(): boolean;
  available(): boolean;
  running(): boolean;
  openCamera(): void;
  closeCamera(): void;
  navigate(point: {id: string; name: string; x: number; z: number; kind: string}): void;
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
const elapsed = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const attemptId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const titleCase = (value: string) => value[0].toUpperCase() + value.slice(1);

function assignments(subjects: RegisteredPhotoSubject[]): PhotoAssignment[] {
  const available = new Set(subjects.map(subject => subject.id));
  const featured = ['9146545', '106948123', '107227742', '107310050', '659605208', '6160033107', '107208288', '107205459'].filter(id => available.has(id));
  const definitions: PhotoAssignment[] = [
    {id: 'first-frame', title: 'First Frame', description: 'Frame the James Scott fountain clearly. A score of 55 or more completes your first assignment.', targets: ['9146545'], count: 1, xp: 50, minCoverage: .018, aerial: false},
    {id: 'island-icon', title: 'Island Icon', description: 'Make a postcard of the Belle Isle Casino. Leave a little room around the architecture.', targets: ['106948123'], count: 1, xp: 60, minCoverage: .018, aerial: false},
    {id: 'aquarium-story', title: 'Aquarium Story', description: 'Find a clear angle on the Aquarium. Keep the subject visible and inside the frame.', targets: ['107227742'], count: 1, xp: 60, minCoverage: .018, aerial: false},
    {id: 'glass-house', title: 'Glass House', description: 'Photograph the Conservatory from a viewpoint that shows its form and glazing.', targets: ['107310050'], count: 1, xp: 70, minCoverage: .018, aerial: false},
    {id: 'tower-lines', title: 'Tower Lines', description: 'Fit the Peace Carillon into one photograph. Try a wider lens or step farther back.', targets: ['659605208'], count: 1, xp: 70, minCoverage: .015, aerial: false},
    {id: 'fine-detail', title: 'Fine Detail', description: 'Fill more of the frame with the James Scott statue. Use your position and lens to get closer.', targets: ['6160033107'], count: 1, xp: 80, minCoverage: .09, aerial: false},
    {id: 'above-it-all', title: 'Above It All', description: 'While riding the hoverbike at least 8 m above the ground, photograph any featured landmark.', targets: featured, count: 1, xp: 90, minCoverage: .012, aerial: true},
    {id: 'island-story', title: 'Island Story', description: 'Build a three-photo story: capture three different featured landmarks. Each shot must score at least 55.', targets: featured, count: 3, xp: 120, minCoverage: .018, aerial: false},
  ];
  return definitions.filter(definition => definition.targets.length >= definition.count && definition.targets.every(id => available.has(id)));
}

/** One activity at a time, with all simulation and capture checks outside DOM handlers. */
export class IslandActivities {
  private readonly contracts: readonly DispatchContract[];
  private readonly subjects: RegisteredPhotoSubject[];
  private readonly quests: PhotoAssignment[];
  private readonly subjectCenters = new Map<string, T.Vector3>();
  private dispatch?: DispatchState;
  private photoAttempt?: PhotoAttempt;
  private dispatchRide: Actor['ride'] = 'onewheel';
  private profile: ActivityProfile;
  private readonly album = new ActivityAlbum();
  private actor: Actor = {x: 0, y: 2, z: 0, speedMps: 0, onFoot: false, ride: 'onewheel', height: 0};
  private tab: ActivityTab = 'dispatch';
  private last?: {tab: 'dispatch' | 'photo'; id: string};
  private lastUi = 0;
  private feedback = '';
  private profileSaved = true;
  private readonly board = node('dialog');
  private readonly results = node('dialog');
  private readonly content = node('div');
  private readonly profileLine = node('div', 'activity-profile');
  private readonly current = node('div', 'activity-current');
  private readonly hud = node('section');
  private readonly hudLabel = node('span', 'activity-eyebrow');
  private readonly hudTitle = node('h3');
  private readonly hudDetail = node('p');
  private readonly hudMeta = node('p', 'activity-hud-meta');
  private readonly hudTime = node('output', 'activity-time');
  private readonly action = button('', () => this.interact(), 'activity-primary');
  private readonly notice = node('div');
  private noticeTimer = 0;
  private readonly markers = new T.Group();
  private markerKey = '';
  private albumUrls: string[] = [];
  private albumRender = 0;
  private readonly launchers: HTMLButtonElement[] = [];
  private dispatchUnavailable = '';

  constructor(private scene: T.Scene, data: ParkMap, private terrain: ParkTerrain, private camera: T.PerspectiveCamera, private canvas: HTMLCanvasElement, private capture: CameraCapture, private hooks: Hooks) {
    try { this.profile = readActivityProfile(localStorage.getItem(ACTIVITY_STORAGE_KEY)); }
    catch { this.profile = readActivityProfile(null); this.profileSaved = false; }
    try { this.contracts = createDispatchContracts(createDispatchStops(data, terrain)); }
    catch (error) { this.contracts = []; this.dispatchUnavailable = error instanceof Error ? error.message : 'Delivery paths are unavailable.'; }
    this.subjects = registerPhotoSubjects(scene, data);
    for (const subject of this.subjects) {
      const bounds = new T.Box3();
      for (const mesh of subject.meshes) {
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        if (mesh.geometry.boundingBox) bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
      }
      this.subjectCenters.set(subject.id, bounds.getCenter(new T.Vector3()));
    }
    this.quests = assignments(this.subjects);
    this.markers.name = 'Activity navigation markers';
    this.markers.userData.photoQuestIgnore = true;
    scene.add(this.markers);
    this.createBoard(); this.createHud();
    this.results.id = 'activity-results'; this.results.setAttribute('aria-label', 'Activity results');
    this.results.addEventListener('close', () => { hooks.clear(); canvas.focus(); });
    this.notice.id = 'activity-notice'; this.notice.hidden = true; this.notice.setAttribute('role', 'status');
    document.body.append(this.results, this.notice);
    const menu = document.querySelector('#ride-menu nav');
    const menuButton = button('Dispatch & Photo Quest · J', () => this.open());
    menuButton.id = 'activities-open'; menu?.prepend(menuButton);
    for (const [label, tab] of [['Swoop Dispatch', 'dispatch'], ['Photo Quest', 'photo']] as const) {
      const launch = button(label, () => this.open(tab), 'activity-welcome');
      launch.disabled = true;
      document.querySelector('.cinema-actions')?.append(launch);
      this.launchers.push(launch);
    }
    capture.observePhotos({snapshot: frame => this.snapshot(frame), complete: (blob, shot) => { if (shot) this.acceptPhoto(blob, shot); }});
  }

  private createBoard() {
    this.board.id = 'activity-board'; this.board.setAttribute('aria-labelledby', 'activity-board-title');
    const title = node('h2', '', 'Make the island your own.'); title.id = 'activity-board-title';
    const nav = node('nav', 'activity-tabs'); nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'Island activities');
    for (const [tab, label] of [['dispatch', 'Swoop Dispatch'], ['photo', 'Photo Quest'], ['album', 'Photo album']] as const) {
      const select = button(label, () => { this.tab = tab; this.renderBoard(); });
      select.id = `activity-tab-${tab}`; select.dataset.tab = tab; select.setAttribute('role', 'tab'); select.setAttribute('aria-controls', 'activity-content');
      nav.append(select);
    }
    nav.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...nav.querySelectorAll<HTMLButtonElement>('button')];
      const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].click(); tabs[next].focus();
    });
    this.content.id = 'activity-content'; this.content.setAttribute('role', 'tabpanel');
    this.board.append(button('Back to island', () => this.board.close(), 'close'), node('span', 'activity-eyebrow', 'DIGITAL STATIC / BELLE ISLE'), title,
      node('p', 'activity-intro', 'Run a delivery shift. Find your next photograph. Earn local XP and unlock photo frames as you explore.'), this.profileLine, this.current, nav, this.content,
      node('p', 'activity-note', 'Records stay in this browser. XP unlocks photo frames and titles. One active assignment at a time; menus and background tabs pause the delivery clock.'));
    this.board.addEventListener('close', () => { this.albumRender++; this.clearAlbumUrls(); this.hooks.clear(); this.canvas.focus(); });
    document.body.append(this.board);
  }
  private createHud() {
    this.hud.id = 'activity-hud'; this.hud.hidden = true; this.hud.setAttribute('aria-label', 'Current activity');
    // Keep the numeric readout from introducing a new live announcement every tick.
    this.hudTime.setAttribute('aria-live', 'off');
    const actions = node('div', 'activity-hud-actions');
    this.action.id = 'activity-action';
    actions.append(this.action, button('Journal · J', () => this.open()));
    this.hud.append(this.hudLabel, this.hudTitle, this.hudDetail, this.hudMeta, actions);
    document.body.append(this.hud);
  }
  private clearAlbumUrls() { this.albumUrls.forEach(url => URL.revokeObjectURL(url)); this.albumUrls = []; }
  private toast(text: string) {
    clearTimeout(this.noticeTimer); this.notice.textContent = text; this.notice.hidden = false;
    this.noticeTimer = window.setTimeout(() => { this.notice.hidden = true; }, 5500);
  }
  private saveProfile() {
    try { localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(this.profile)); this.profileSaved = true; }
    catch { this.profileSaved = false; }
  }
  get active() { return !!this.dispatch || !!this.photoAttempt; }
  get kind() { return this.dispatch ? 'dispatch' : this.photoAttempt ? 'photo' : null; }
  key(event: KeyboardEvent) {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return false;
    if (event.code === 'KeyJ' && this.hooks.available()) { event.preventDefault(); this.open(); return true; }
    if (event.code === 'KeyB' && this.dispatch && this.hooks.running()) { event.preventDefault(); this.interact(); return true; }
    return false;
  }
  open(tab?: ActivityTab) {
    if (!this.hooks.ready() || !this.hooks.available()) { this.toast('Return to exploration to choose an activity.'); return; }
    this.hooks.clear();
    const menu = document.querySelector<HTMLDialogElement>('#ride-menu'); if (menu?.open) menu.close();
    if (this.results.open) this.results.close();
    this.tab = tab ?? (this.photoAttempt ? 'photo' : 'dispatch');
    this.renderBoard(); if (!this.board.open) this.board.showModal();
  }
  private renderBoard() {
    this.albumRender++; this.clearAlbumUrls(); this.content.replaceChildren();
    const xp = activityXp(this.profile);
    this.profileLine.replaceChildren(node('strong', '', `${xp} XP`), node('span', '', activityTitle(xp)), node('span', '', `${Object.keys(this.profile.records).length} first clears`));
    if (!this.profileSaved) this.profileLine.append(node('span', '', 'Session progress · browser storage unavailable'));
    this.current.hidden = !this.active;
    this.current.replaceChildren(node('span', '', this.dispatch ? `In progress: ${this.dispatch.contract.title}` : this.photoAttempt ? `In progress: ${this.photoAttempt.assignment.title}` : ''), button('End activity', () => { this.interrupt(); this.renderBoard(); }));
    for (const tab of this.board.querySelectorAll<HTMLButtonElement>('[role=tab]')) {
      const selected = tab.dataset.tab === this.tab; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    }
    this.content.setAttribute('aria-labelledby', `activity-tab-${this.tab}`);
    if (this.tab === 'album') { void this.renderAlbum(this.albumRender); return; }
    const grid = node('div', 'activity-grid'); this.content.append(grid);
    const items = this.tab === 'dispatch' ? this.contracts : this.quests;
    for (const [index, item] of items.entries()) {
      const isDispatch = this.tab === 'dispatch';
      const id = `${this.tab}:${item.id}`;
      const record = this.profile.records[id];
      const xp = isDispatch ? (item as DispatchContract).firstClearXp : (item as PhotoAssignment).xp;
      const card = node('article', 'activity-card');
      card.append(node('span', 'activity-meta', `${String(index + 1).padStart(2, '0')} / ${record ? `${titleCase(record.medal)} · ${record.bestScore} best` : `${xp} XP first clear`}`), node('h3', '', item.title), node('p', '', item.description));
      if (isDispatch) {
        const contract = item as DispatchContract;
        card.append(node('p', 'activity-meta', contract.softTimeLimitSeconds === null ? 'Untimed first delivery' : `Gold target ${elapsed(contract.softTimeLimitSeconds)} · late deliveries count`));
      } else {
        const quest = item as PhotoAssignment;
        card.append(node('p', 'activity-meta', `${quest.count === 1 ? '1 qualifying photo' : `${quest.count} different landmarks`} · 55+ points per shot`));
      }
      const start = button(record ? 'Replay assignment' : 'Start assignment', () => {
        if (isDispatch) this.beginDispatch(item as DispatchContract); else this.beginPhoto(item as PhotoAssignment);
      });
      start.disabled = this.active; start.title = this.active ? 'Finish or end your current activity first.' : '';
      card.append(start); grid.append(card);
    }
    if (!items.length) this.content.append(node('p', 'activity-intro', this.tab === 'dispatch' ? this.dispatchUnavailable || 'Delivery paths are unavailable in this scene.' : 'Photo subjects are still unavailable. Return after the island has loaded.'));
  }
  private prepareStart() {
    if (this.active || !this.hooks.available()) return false;
    this.hooks.clear(); this.hooks.closeCamera();
    if (this.board.open) this.board.close(); if (this.results.open) this.results.close();
    this.hooks.start(); this.feedback = '';
    return true;
  }
  private beginDispatch(contract: DispatchContract) {
    if (!this.prepareStart()) return;
    this.dispatch = startDispatch(contract, attemptId()); this.dispatchRide = this.actor.ride;
    this.last = {tab: 'dispatch', id: contract.id}; this.tab = 'dispatch';
    this.pointToNext(); this.toast('Follow the parcel marker. Stop, step off your ride, then hand off with B or the on-screen button.');
    this.refreshHud();
  }
  private beginPhoto(assignment: PhotoAssignment) {
    if (!this.prepareStart()) return;
    this.photoAttempt = {id: attemptId(), assignment, accepted: new Map()};
    this.last = {tab: 'photo', id: assignment.id}; this.tab = 'photo'; this.pointToNext();
    this.toast('Find your subject. Open the camera with P, then use Photo or Space to capture it.');
    this.refreshHud();
  }
  private nextSubject() {
    const attempt = this.photoAttempt; if (!attempt) return undefined;
    return this.subjects.filter(subject => attempt.assignment.targets.includes(subject.id) && !attempt.accepted.has(subject.id))
      .map(subject => ({subject, distance: this.subjectCenter(subject).distanceTo(new T.Vector3(this.actor.x, this.actor.y, this.actor.z))}))
      .sort((a, b) => a.distance - b.distance)[0]?.subject;
  }
  private subjectCenter(subject: RegisteredPhotoSubject) {
    return this.subjectCenters.get(subject.id)!.clone();
  }
  private pointToNext() {
    if (this.dispatch) {
      const target = [...getDispatchTargets(this.dispatch)].sort((a, b) => Math.hypot(a.x - this.actor.x, a.z - this.actor.z) - Math.hypot(b.x - this.actor.x, b.z - this.actor.z))[0];
      if (target) this.hooks.navigate({...target, kind: 'delivery'});
    } else {
      const subject = this.nextSubject();
      if (subject) { const center = this.subjectCenter(subject); this.hooks.navigate({id: subject.id, name: subject.label, x: center.x, z: center.z, kind: 'photo'}); }
    }
    this.syncMarkers();
  }
  /** Fast travel ends a delivery run; photographs remain valid wherever the player finds a viewpoint. */
  relocated() { if (this.dispatch) this.interrupt('Delivery ended after fast travel. Start a new shift from the journal.'); }
  interrupt(message = '') {
    this.dispatch = undefined; this.photoAttempt = undefined; this.feedback = ''; this.hud.hidden = true;
    this.clearMarkers();
    if (message) this.toast(message);
  }
  update(deltaSeconds: number, actor: Actor, now: number) {
    this.actor = {...actor};
    const ready = this.hooks.ready(); this.launchers.forEach(launch => { launch.disabled = !ready; });
    if (this.dispatch) {
      this.dispatch = advanceDispatchTime(this.dispatch, deltaSeconds, !this.hooks.running());
      if (actor.ride === 'hoverbike') this.dispatchRide = 'hoverbike';
    }
    this.markers.visible = !!this.dispatch && this.hooks.available();
    if (now - this.lastUi >= 250) { this.lastUi = now; this.refreshHud(); }
  }
  private refreshHud() {
    this.hud.hidden = !this.active || !this.hooks.available() || document.body.classList.contains('at-start');
    if (!this.active) return;
    if (this.dispatch) {
      const state = this.dispatch;
      const target = [...getDispatchTargets(state)].sort((a, b) => Math.hypot(a.x - this.actor.x, a.z - this.actor.z) - Math.hypot(b.x - this.actor.x, b.z - this.actor.z))[0];
      this.hudLabel.textContent = 'SWOOP DISPATCH'; this.hudTitle.textContent = state.contract.title;
      const verb = state.phase === 'pickup' ? 'Collect at' : state.phase === 'return' ? 'Return to' : 'Deliver to';
      this.hudDetail.textContent = target ? `${verb} ${target.name} · ${Math.round(Math.hypot(target.x - this.actor.x, target.z - this.actor.z))} m` : 'Shift complete';
      const pause = this.hooks.running() ? '' : ' · paused';
      const progress = `${state.completedDropoffIds.length}/${state.contract.dropoffs.length || 1} stops · `;
      if (state.contract.softTimeLimitSeconds === null) this.hudMeta.textContent = `${progress}Take your time${pause}`;
      else {
        this.hudTime.textContent = elapsed(state.elapsedSeconds);
        this.hudMeta.replaceChildren(progress, this.hudTime, pause);
      }
      const check = tryDispatchHandoff(state, this.actor);
      this.action.disabled = !this.hooks.running() || !check.event;
      this.action.textContent = check.reason === 'on-foot-required' ? 'Land & step off · F' : check.reason === 'slow-down' ? 'Stop to hand off' : check.reason === 'out-of-range' ? 'Follow the marker' : check.reason === 'wrong-height' ? 'Reach ground level' : state.phase === 'pickup' ? 'Collect parcel · B' : state.phase === 'return' ? 'Finish shift · B' : 'Deliver parcel · B';
      this.action.title = 'Handoffs need walking mode, low speed, and proximity to the marked stop.';
    } else if (this.photoAttempt) {
      const attempt = this.photoAttempt, next = this.nextSubject();
      this.hudLabel.textContent = 'PHOTO QUEST'; this.hudTitle.textContent = attempt.assignment.title;
      this.hudDetail.textContent = this.feedback || (next ? `Next subject: ${next.label}` : 'All photographs captured.');
      this.hudMeta.textContent = `${attempt.accepted.size}/${attempt.assignment.count} photos · ${attempt.assignment.aerial ? 'Hoverbike · 8 m+ above ground' : '55+ points per photograph'}`;
      this.action.disabled = !this.hooks.running();
      this.action.textContent = this.capture.active ? 'Capture · Space' : 'Open camera · P'; this.action.title = '';
    }
  }
  private interact() {
    if (!this.hooks.running()) return;
    if (this.photoAttempt) { if (this.capture.active) this.capture.shutter(); else this.hooks.openCamera(); this.canvas.focus(); return; }
    if (!this.dispatch) return;
    const handoff = tryDispatchHandoff(this.dispatch, this.actor);
    if (!handoff.event) return;
    this.dispatch = handoff.state;
    if (this.dispatch.phase === 'completed') {
      const claim = claimDispatchCompletion(this.dispatch); this.dispatch = claim.state;
      if (claim.completion) {
        const done = claim.completion, title = this.dispatch.contract.title;
        const score = done.medal === 'gold' ? 95 : done.medal === 'silver' ? 80 : 65;
        this.dispatch = undefined; this.clearMarkers();
        this.finish(`dispatch:${done.contractId}`, title, done.firstClearXp, score, `Delivery complete in ${elapsed(done.elapsedSeconds)}.`, done.elapsedSeconds, this.dispatchRide);
      }
    } else { this.pointToNext(); this.toast(handoff.event.type === 'pickup' ? 'Parcel collected. Your next stop is marked.' : 'Delivery accepted. Follow the next marker.'); }
    this.refreshHud();
    if (!document.querySelector('dialog[open]')) this.canvas.focus();
  }
  private snapshot(frame: PhotoCaptureFrame): Shot | null {
    const attempt = this.photoAttempt;
    if (!attempt || !this.hooks.running() || !this.capture.active) return null;
    const candidates = this.subjects.filter(subject => attempt.assignment.targets.includes(subject.id) && !attempt.accepted.has(subject.id));
    let best: Shot | null = null;
    for (const subject of candidates) {
      const evaluation = evaluatePhotoSubject(subject, this.camera, this.scene, {
        crop: frame,
        minCoverage: attempt.assignment.minCoverage,
      });
      const aerial = !attempt.assignment.aerial || (this.actor.ride === 'hoverbike' && this.actor.height >= 8);
      const shot: Shot = {attemptId: attempt.id, assignmentId: attempt.assignment.id, subjectId: subject.id, subjectName: subject.label,
        score: evaluation.score, valid: evaluation.valid && evaluation.score >= 55 && aerial,
        feedback: !aerial ? 'Use the hoverbike at least 8 m above the ground.' : evaluation.valid && evaluation.score < 55 ? `Framing score ${evaluation.score}/100. Move closer and center the landmark to reach 55.` : evaluation.feedback};
      if (!best || Number(shot.valid) > Number(best.valid) || (shot.valid === best.valid && shot.score > best.score)) best = shot;
    }
    return best;
  }
  private acceptPhoto(blob: Blob, shot: Shot) {
    const attempt = this.photoAttempt;
    if (!attempt || attempt.id !== shot.attemptId || attempt.assignment.id !== shot.assignmentId || attempt.accepted.has(shot.subjectId) || !blob.size) return;
    if (!shot.valid) { this.feedback = shot.feedback || 'Try a clearer view with the whole subject in frame.'; this.toast(this.feedback); this.refreshHud(); return; }
    attempt.accepted.set(shot.subjectId, shot.score);
    const photo: AlbumPhoto = {id: attemptId(), assignment: attempt.assignment.title, subject: shot.subjectName, score: shot.score, createdAt: Date.now(), blob};
    this.album.stage(photo);
    void albumImage(blob).then(image => this.album.save({...photo, blob: image})).then(saved => {
      if (!saved) this.toast('Photo kept for this session. Download it from the album; browser storage is unavailable.');
    }).catch(() => { void this.album.save(photo); this.toast('Photo kept at its original size. Open the album to download it.'); });
    this.feedback = `${shot.subjectName}: ${shot.score} points. Saved to your album.`;
    if (attempt.accepted.size >= attempt.assignment.count) {
      const score = Math.round([...attempt.accepted.values()].reduce((sum, value) => sum + value, 0) / attempt.accepted.size);
      const assignment = attempt.assignment;
      this.photoAttempt = undefined; this.hooks.closeCamera();
      this.finish(`photo:${assignment.id}`, assignment.title, assignment.xp, score, `${attempt.accepted.size} qualifying ${attempt.accepted.size === 1 ? 'photograph' : 'photographs'}.\nYour shots are in the photo album.`);
    } else { this.pointToNext(); this.toast(this.feedback); }
    this.refreshHud();
  }
  private finish(id: string, title: string, baseXp: number, score: number, detail: string, seconds?: number, ride?: string) {
    const award = completeActivity(this.profile, {id, baseXp, score, seconds, ride}); this.profile = award.profile;
    this.saveProfile(); this.hooks.clear(); this.hud.hidden = true;
    if (this.board.open) this.board.close();
    const label = node('span', 'activity-eyebrow', `${id.startsWith('dispatch:') ? 'SHIFT COMPLETE' : 'ASSIGNMENT COMPLETE'} / ${titleCase(award.medal)}`);
    const description = detail + (award.earnedXp ? `\n+${award.earnedXp} XP · ${activityXp(this.profile)} XP total` : award.improved ? '\nNew best score · first-clear XP already earned' : '\nAssignment replayed · first-clear XP already earned') + (!this.profileSaved ? '\nProgress is available for this session; browser storage could not be saved.' : '');
    const actions = node('div', 'activity-result-actions');
    actions.append(button('Play again', () => this.replay(), 'activity-primary'), button('Choose activity', () => this.open(this.last?.tab)), button('Photo album', () => this.open('album')), button('Keep exploring', () => this.results.close()));
    this.results.replaceChildren(label, node('h2', '', title), node('div', 'activity-result-score', `${score}`), node('p', 'activity-result-detail', description), actions);
    if (!this.results.open) this.results.showModal();
  }
  private replay() {
    if (this.results.open) this.results.close();
    if (this.last?.tab === 'dispatch') { const contract = this.contracts.find(item => item.id === this.last?.id); if (contract) this.beginDispatch(contract); }
    else { const quest = this.quests.find(item => item.id === this.last?.id); if (quest) this.beginPhoto(quest); }
  }
  private async renderAlbum(render: number) {
    const choice = node('label', 'activity-frame-choice', 'Download frame');
    const select = node('select'); select.setAttribute('aria-label', 'Photo download frame');
    const xp = activityXp(this.profile);
    for (const frame of PHOTO_FRAMES) {
      const option = new Option(`${frame.label}${xp < frame.xp ? ` · unlock at ${frame.xp} XP` : ''}`, frame.id);
      option.disabled = xp < frame.xp; select.add(option);
    }
    select.value = this.profile.frame;
    select.onchange = () => { const frame = PHOTO_FRAMES.find(item => item.id === select.value && item.xp <= activityXp(this.profile)); if (frame) { this.profile.frame = frame.id; this.saveProfile(); } };
    choice.append(select);
    const status = node('p', 'activity-note', 'Loading your photographs…');
    this.content.append(choice, status);
    const photos = await this.album.list();
    if (render !== this.albumRender || this.tab !== 'album') return;
    status.textContent = photos.length ? 'Your latest 24 qualifying photographs stay in this browser. Downloads include the selected Digital Static frame.' : 'Your album starts with your first qualifying Photo Quest capture. Choose an assignment, find the subject, and take a photo.';
    const gallery = node('div', 'activity-album');
    for (const photo of photos) {
      const figure = node('figure', 'activity-photo'), image = node('img');
      const url = URL.createObjectURL(photo.blob); this.albumUrls.push(url); image.src = url; image.alt = `${photo.subject} — your Photo Quest photograph`; image.loading = 'lazy';
      const caption = node('figcaption'); caption.append(node('strong', '', photo.subject), node('span', '', `${photo.assignment} · ${photo.score} points`));
      const download = button('Download photo', () => {
        download.disabled = true;
        void downloadAlbumPhoto(photo, this.profile.frame).catch(() => this.toast('Download could not finish. Try again.')).finally(() => { download.disabled = false; });
      });
      caption.append(download); figure.append(image, caption); gallery.append(figure);
    }
    this.content.append(gallery);
  }
  private clearMarkers() {
    this.markers.traverse(object => { if (object instanceof T.Mesh) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); } });
    this.markers.clear(); this.markerKey = '';
  }
  private syncMarkers() {
    const targets = this.dispatch ? getDispatchTargets(this.dispatch) : [];
    const key = targets.map(target => target.id).join('|'); if (key === this.markerKey) return;
    this.clearMarkers(); this.markerKey = key;
    for (const target of targets) {
      const group = new T.Group(); group.position.set(target.x, target.y + .12, target.z);
      const ring = new T.Mesh(new T.TorusGeometry(3.5, .13, 6, 32), new T.MeshBasicMaterial({color: 0x81d8c9, depthWrite: false})); ring.rotation.x = Math.PI / 2;
      const beam = new T.Mesh(new T.CylinderGeometry(.13, .13, 9, 6), new T.MeshBasicMaterial({color: 0xe4b871, transparent: true, opacity: .72, depthWrite: false})); beam.position.y = 4.5;
      group.add(ring, beam); this.markers.add(group);
    }
  }
  drawMap(context: CanvasRenderingContext2D, px: (x: number) => number, pz: (z: number) => number) {
    const points = this.dispatch ? getDispatchTargets(this.dispatch).map(target => ({x: target.x, z: target.z})) : this.photoAttempt ? (() => { const subject = this.nextSubject(); return subject ? [this.subjectCenter(subject)] : []; })() : [];
    context.save(); context.fillStyle = this.dispatch ? '#e4b871' : '#bfa2f0'; context.strokeStyle = '#0b2229'; context.lineWidth = 2;
    for (const point of points) { const x = px(point.x), z = pz(point.z); context.beginPath(); context.moveTo(x, z - 6); context.lineTo(x + 6, z); context.lineTo(x, z + 6); context.lineTo(x - 6, z); context.closePath(); context.fill(); context.stroke(); }
    context.restore();
  }
}
