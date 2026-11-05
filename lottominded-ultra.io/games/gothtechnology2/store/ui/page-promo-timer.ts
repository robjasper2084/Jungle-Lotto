type Schedule = (callback: () => void, delayMs: number) => () => void;
const schedule: Schedule = (callback, delayMs) => {
  const timer = setTimeout(callback, delayMs);
  return () => clearTimeout(timer);
};

/** Once per page load; wait if another interaction would be interrupted. */
export function schedulePagePromo(
  delayMs: number,
  actions: { canShow: () => boolean; show: () => void },
  later: Schedule = schedule,
) {
  let stopped = false;
  let cancel = () => {};
  const check = () => {
    if (stopped) return;
    if (!actions.canShow()) { cancel = later(check, 500); return; }
    stopped = true;
    actions.show();
  };
  cancel = later(check, delayMs);
  return () => { stopped = true; cancel(); };
}
