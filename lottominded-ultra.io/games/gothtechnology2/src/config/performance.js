const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const PERFORMANCE_PROFILES = Object.freeze({
  desktop: Object.freeze({
    id: "desktop",
    renderScale: 1,
    smoothingQuality: "high",
    effects: "full",
    dynamicStageEffects: true,
    afterimages: true,
    maxEffects: 32,
    maxProjectileTrail: 12,
    targetRenderFps: 60
  }),
  mobile: Object.freeze({
    id: "mobile-balanced",
    renderScale: 0.75,
    smoothingQuality: "medium",
    effects: "reduced",
    dynamicStageEffects: true,
    afterimages: false,
    maxEffects: 20,
    maxProjectileTrail: 6,
    targetRenderFps: 60
  }),
  constrained: Object.freeze({
    id: "mobile-constrained",
    renderScale: 0.625,
    smoothingQuality: "medium",
    effects: "reduced",
    dynamicStageEffects: false,
    afterimages: false,
    maxEffects: 14,
    maxProjectileTrail: 4,
    targetRenderFps: 60
  })
});

export const selectPerformanceProfile = ({
  coarsePointer = false,
  shortViewport = 1080,
  deviceMemory = 8,
  hardwareConcurrency = 8,
  saveData = false,
  reducedMotion = false
} = {}) => {
  if (!coarsePointer) return PERFORMANCE_PROFILES.desktop;
  const memory = numberOr(deviceMemory, 8);
  const cores = numberOr(hardwareConcurrency, 8);
  const constrained = saveData || reducedMotion || memory <= 4 || cores <= 4 || numberOr(shortViewport, 1080) <= 420;
  return constrained ? PERFORMANCE_PROFILES.constrained : PERFORMANCE_PROFILES.mobile;
};

export const detectPerformanceProfile = (scope = window) => {
  const navigatorLike = scope.navigator ?? {};
  const connection = navigatorLike.connection ?? navigatorLike.mozConnection ?? navigatorLike.webkitConnection;
  return selectPerformanceProfile({
    coarsePointer: scope.matchMedia?.("(pointer: coarse)")?.matches ?? false,
    shortViewport: Math.min(numberOr(scope.innerWidth, 1280), numberOr(scope.innerHeight, 720)),
    deviceMemory: navigatorLike.deviceMemory,
    hardwareConcurrency: navigatorLike.hardwareConcurrency,
    saveData: Boolean(connection?.saveData),
    reducedMotion: scope.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
  });
};
