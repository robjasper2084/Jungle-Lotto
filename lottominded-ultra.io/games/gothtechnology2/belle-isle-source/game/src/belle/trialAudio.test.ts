import test from 'node:test';
import assert from 'node:assert/strict';
import {TrialAudio, TRIAL_AUDIO_KEY, trialTones} from './trialAudio.ts';

function fakeAudio() {
  const starts: number[] = [], stops: (number | undefined)[] = [];
  let resumes = 0, created = 0;
  const parameter = () => ({value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}});
  const context = {state: 'running', currentTime: 10, destination: {},
    async resume() { resumes++; },
    createGain: () => ({gain: parameter(), connect() {}, disconnect() {}}),
    createOscillator: () => ({type: '', frequency: parameter(), onended: null, connect() {}, disconnect() {},
      start(time: number) { starts.push(time); }, stop(time?: number) { stops.push(time); }}),
  } as unknown as AudioContext;
  return {context, starts, stops, factory: () => { created++; return context; }, get created() { return created; }, get resumes() { return resumes; }};
}

test('gate audio is opt-in and does not create or resume a context on load or checkpoint', async () => {
  const fake = fakeAudio(), saved = new Map<string, string>();
  const audio = new TrialAudio({storage: {getItem: key => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value); }}, createContext: fake.factory});
  audio.checkpoint();
  assert.equal(fake.created, 0); assert.equal(fake.resumes, 0); assert.deepEqual(fake.starts, []);
  await audio.setEnabled(true);
  assert.equal(saved.get(TRIAL_AUDIO_KEY), 'on'); assert.equal(fake.created, 1); assert.equal(fake.resumes, 1);
  assert.equal(fake.starts.length, 2, 'the opt-in gesture previews one checkpoint cue');
  audio.checkpoint(true); assert.equal(fake.starts.length, 5, 'the finish has its own three-note cue');
  await audio.setEnabled(false);
  assert.equal(saved.get(TRIAL_AUDIO_KEY), 'off');
  assert.ok(fake.stops.some(time => time === undefined), 'muting cancels active voices');
  audio.checkpoint(); assert.equal(fake.starts.length, 5);
});

test('persisted opt-in still waits for a user gesture and denied audio stays silent', async () => {
  const fake = fakeAudio();
  const audio = new TrialAudio({storage: {getItem: () => 'on', setItem() {}}, createContext: fake.factory});
  assert.equal(audio.enabled, true); audio.checkpoint(); assert.equal(fake.created, 0);
  await audio.unlock(); assert.equal(fake.created, 1); assert.equal(fake.starts.length, 0, 'starting a course does not play a checkpoint');
  const denied = new TrialAudio({storage: null, createContext: () => { throw new Error('Unavailable'); }});
  assert.equal(await denied.setEnabled(true), false); assert.match(denied.status, /could not start/);
  denied.checkpoint(); await denied.setEnabled(false); assert.equal(denied.enabled, false);
});

test('checkpoint and finish envelopes are short, quiet, ordered and distinct', () => {
  const gate = trialTones(), finish = trialTones(true);
  assert.notDeepEqual(gate, finish);
  for (const tones of [gate, finish]) {
    assert.ok(tones.every(tone => tone.frequency > 0 && tone.gain > 0 && tone.gain < .1 && tone.duration > 0 && tone.offset + tone.duration < .5));
    assert.ok(tones.every((tone, index) => index === 0 || tone.offset > tones[index - 1].offset));
  }
});


test('pausing or leaving cancels an awaiting preview without disabling later gate cues', async () => {
  const fake = fakeAudio();
  let resume!: () => void;
  fake.context.resume = () => new Promise<void>(resolve => { resume = resolve; });
  const audio = new TrialAudio({storage: null, createContext: fake.factory});
  const pending = audio.setEnabled(true);
  audio.silence();
  resume(); await pending;
  assert.equal(fake.starts.length, 0, 'a delayed unlock cannot restart a cancelled preview');
  audio.checkpoint();
  assert.equal(fake.starts.length, 2, 'the next legitimate gate still has sound');
});
