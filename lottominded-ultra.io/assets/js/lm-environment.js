(function initLottoMindEnvironment(global) {
  "use strict";

  if (global.LottoMindEnvironment) return;

  var marker = global.__LOTTOMIND_ENVIRONMENT_MARKER__;
  var isStaging = Boolean(
    marker &&
    marker.name === "staging" &&
    marker.marker === "lottomind-upgrade-preview-v1"
  );

  var environment = isStaging
    ? {
        name: "staging",
        isProduction: false,
        allowLivePayments: false,
        allowAccountWrites: Boolean(marker.isolatedStagingBackend && marker.allowAccountWrites),
        allowRedemptions: Boolean(marker.isolatedStagingBackend && marker.allowTestRedemptions),
        allowProductionAnalytics: false,
        allowTestPayments: Boolean(marker.isolatedStagingBackend && marker.stripeTestModeVerified),
        hasIsolatedStagingBackend: Boolean(marker.isolatedStagingBackend),
        stagingBackendOrigin: marker.stagingBackendOrigin || "",
      }
    : {
        name: "production",
        isProduction: true,
        allowLivePayments: true,
        allowAccountWrites: true,
        allowRedemptions: true,
        allowProductionAnalytics: true,
        allowTestPayments: false,
        hasIsolatedStagingBackend: false,
        stagingBackendOrigin: "",
      };

  Object.defineProperty(global, "LottoMindEnvironment", {
    configurable: false,
    enumerable: true,
    writable: false,
    value: Object.freeze(environment),
  });
})(window);
