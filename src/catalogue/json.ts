/** Preserve native JSON numeric lexemes, including decimals beyond IEEE-754 precision. */
export function parseNativeJson(text: string): unknown {
  return JSON.parse(text.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => token.startsWith('"') ? token : JSON.stringify(token)));
}
