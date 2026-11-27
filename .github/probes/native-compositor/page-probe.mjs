// This function is serialized by Playwright. It owns only its observer data.
// It never replaces game, input, renderer, clock, or original measurement APIs.
export function installPageProbe(limits) {
  if (window !== window.top) return;
  const raf = new Float64Array(limits.rafSamples * 2);
  const tasks = new Float64Array(limits.longTasks * 2);
  const marks = [];
  let active = false, startedAt = null, endedAt = null, stoppedBy = null;
  let rafCount = 0, rafTotal = 0, taskCount = 0, taskTotal = 0, markOverflow = 0;
  let keydowns = 0, keyups = 0, firstW = false, taskObserver = null;
  let taskSupport = false, rafId = null;
  const mark = (name, detail = {}) => {
    const now = performance.now();
    if (marks.length < limits.marks) marks.push({name, atMs: now, ...detail});
    else markOverflow++;
    performance.mark('belle-native-cpu:' + name);
  };
  function recordTasks(entries) {
    for (const task of entries) {
      if (startedAt === null || task.startTime < startedAt || (endedAt !== null && task.startTime > endedAt)) continue;
      taskTotal++;
      if (taskCount < limits.longTasks) {
        tasks[taskCount * 2] = task.startTime;
        tasks[taskCount * 2 + 1] = task.duration;
        taskCount++;
      }
    }
  }
  try {
    taskObserver = new PerformanceObserver(list => recordTasks(list.getEntries()));
    taskObserver.observe({type: 'longtask'});
    taskSupport = true;
  } catch { /* Unsupported long tasks are recorded explicitly. */ }
  function tick(timestamp) {
    if (!active) return;
    rafTotal++;
    if (rafCount < limits.rafSamples) {
      raf[rafCount * 2] = timestamp;
      raf[rafCount * 2 + 1] = performance.now();
      rafCount++;
    }
    rafId = requestAnimationFrame(tick);
  }
  function stop(reason) {
    if (!active) return;
    mark(reason);
    endedAt = performance.now();
    active = false; stoppedBy = reason;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (taskObserver) recordTasks(taskObserver.takeRecords());
  }
  document.addEventListener('click', event => {
    if (!active || !event.isTrusted || !(event.target instanceof Element)) return;
    const button = event.target.closest('#ride-profile > button');
    if (button && button.textContent.startsWith('Start')) mark('profile-start-click');
  }, true);
  document.addEventListener('keydown', event => {
    if (!active || !event.isTrusted || event.code !== 'KeyW') return;
    keydowns++;
    if (!firstW) { firstW = true; mark('first-trusted-w'); }
  }, true);
  document.addEventListener('keyup', event => {
    if (!active || !event.isTrusted || event.code !== 'KeyW') return;
    keyups++; stop('trusted-w-keyup');
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (active) mark(document.hidden ? 'hidden' : 'visible');
  });
  Object.defineProperty(window, '__belleNativeCpuObserver', {value: {
    start() {
      if (startedAt !== null) return false;
      active = true; startedAt = performance.now();
      mark('observer-start'); rafId = requestAnimationFrame(tick); return true;
    },
    stop,
    snapshot() {
      if (taskObserver) recordTasks(taskObserver.takeRecords());
      return {
        timeOriginMs: performance.timeOrigin, startedAtMs: startedAt, endedAtMs: endedAt, active, stoppedBy,
        keydowns, keyups, marks: marks.slice(), markOverflow, longTaskSupported: taskSupport,
        raf: {columns: ['rafTimestampMs', 'callbackEntryPerformanceNowMs'], total: rafTotal, stored: rafCount,
          overflow: rafTotal - rafCount, values: Array.from(raf.subarray(0, rafCount * 2))},
        longTasks: {columns: ['startTimeMs', 'durationMs'], total: taskTotal, stored: taskCount,
          overflow: taskTotal - taskCount, values: Array.from(tasks.subarray(0, taskCount * 2))},
        note: 'Independent browser callbacks and main-thread long tasks, not game draws or GPU timing. Tasks beginning in the observer window can finish after its end. Diagnostic observer/checkpoint overhead is included.'
      };
    }
  }});
}
