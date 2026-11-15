/** Serialize the CSS actually loaded by the running game, in cascade order.
 * Vite's lazy scene chunk can own HUD rules absent from the entry HTML.
 * This is CSS evidence only: never change a selector, viewport or assertion. */
export function readLoadedStyles(document = globalThis.document) {
  document ??= globalThis.document;
  const sources = [];
  function render(sheet, ancestors = new Set()) {
    if (sheet.disabled) return '';
    if (ancestors.has(sheet)) throw Error('Cyclic stylesheet import');
    const next = new Set(ancestors); next.add(sheet);
    // Access failures are fatal: silently dropping a sheet recreates the bug.
    const rules = Array.from(sheet.cssRules);
    sources.push(sheet.href || 'inline');
    const css = rules.map(rule => rule.type === 3
      ? render(rule.styleSheet, next) : rule.cssText).join('\n');
    const media = sheet.media?.mediaText;
    return media && media !== 'all' ? '@media ' + media + '{\n' + css + '\n}' : css;
  }
  const sheets = [...Array.from(document.styleSheets), ...Array.from(document.adoptedStyleSheets || [])];
  const css = sheets.map(sheet => render(sheet)).filter(Boolean).join('\n');
  if (!css.includes('#trial-hud') || !css.includes('#hover-hud')) {
    throw Error('Loaded game styles are incomplete: trial and hoverbike rules are required');
  }
  return {css, sources, sheetCount: sources.length};
}
