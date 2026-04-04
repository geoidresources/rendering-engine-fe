
export function addParamToUrl(
  url: string,
  key: string,
  value: string | number | boolean
): string {
  const urlObj = new URL(url, "http://__placeholder__");
  urlObj.searchParams.set(key, String(value));

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return urlObj.toString();
  }

  return urlObj.pathname + urlObj.search;
}


export function addParamsToUrl(
  url: string,
  params: Record<string, string | number | boolean | null | undefined>
): string {
  let result = url;
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      result = addParamToUrl(result, key, value);
    }
  }
  return result;
}


export function removeParamFromUrl(url: string, key: string): string {
  const urlObj = new URL(url, "http://__placeholder__");
  urlObj.searchParams.delete(key);

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return urlObj.toString();
  }

  return urlObj.pathname + urlObj.search;
}


export function getParamsFromUrl(url: string): Record<string, string> {
  const urlObj = new URL(url, "http://__placeholder__");
  const params: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}
