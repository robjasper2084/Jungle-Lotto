// Only Playwright driver-side methods are wrapped. Arguments and native results
// retain their identity. The original driver and every game function stay intact.
export function installHooks(chromium, createMonitor) {
  const nativeLaunch = chromium.launch;
  let attached = false;
  chromium.launch = async function (...launchArguments) {
    const browser = await nativeLaunch.apply(this, launchArguments);
    const nativeNewPage = browser.newPage, nativeClose = browser.close;
    let monitor;
    browser.newPage = async function (...pageArguments) {
      const page = await nativeNewPage.apply(this, pageArguments);
      const options = pageArguments[0];
      if (!attached && options?.viewport?.width === 1440 && options?.viewport?.height === 900) {
        attached = true;
        monitor = createMonitor({page, browser, launchArguments, pageArguments});
        try { await monitor.attach(); } catch (error) { monitor.error('attach', error); }
        const context = page.context(), nativeSession = context.newCDPSession;
        let hookedSession = false;
        context.newCDPSession = async function (...sessionArguments) {
          const session = await nativeSession.apply(this, sessionArguments);
          if (sessionArguments[0] !== page || hookedSession) return session;
          hookedSession = true;
          const nativeSend = session.send;
          let metricCalls = 0;
          session.send = async function (...sendArguments) {
            if (sendArguments[0] === 'Performance.getMetrics' && metricCalls === 0) {
              try {
                // Finish observer setup BEFORE the original initial counters,
                // preserving the original counters' wall-time boundary.
                await monitor.start(() => nativeSession.call(context, page));
              } catch (error) { monitor.error('start', error); }
            }
            const result = await nativeSend.apply(this, sendArguments);
            if (sendArguments[0] === 'Performance.getMetrics') {
              metricCalls++;
              monitor.metricsCall?.(metricCalls);
              if (metricCalls === 2) {
                // Crucial: no awaiting stop, trace drain, snapshots, or file I/O
                // on the original ending metrics/keyboard/report path.
                void monitor.stop('original-ending-metrics').catch(error => monitor.error('stop', error));
              }
            }
            return result;
          };
          return session;
        };
      }
      return page;
    };
    browser.close = async function (...closeArguments) {
      if (monitor) {
        try { await monitor.cleanup(); } catch (error) { monitor.error('cleanup', error); }
      }
      return nativeClose.apply(this, closeArguments);
    };
    return browser;
  };
  return () => { chromium.launch = nativeLaunch; };
}
