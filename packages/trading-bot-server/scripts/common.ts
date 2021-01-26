export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function superParseFloat(floatString: number | string, decimals?: number) {
  floatString = floatString?.toString();
  return typeof decimals === 'undefined'
    ? parseFloat(floatString)
    : parseFloat(parseFloat(floatString).toFixed(decimals));
}
