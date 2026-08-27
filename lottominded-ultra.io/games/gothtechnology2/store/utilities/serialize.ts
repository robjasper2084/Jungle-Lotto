/** Escape the HTML parser's opening delimiter in JSON embedded in a script element. */
export const serialize = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');
