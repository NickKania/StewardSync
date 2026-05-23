import { Params } from "@angular/router";

export function getStringParam(params: Params, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

export function getBooleanParam(params: Params, key: string): boolean {
  const value = params[key];
  return value === "true" || value === "1";
}

export function syncQueryParams(
  router: import("@angular/router").Router,
  route: import("@angular/router").ActivatedRoute,
  filterParams: Record<string, string | undefined>,
  filterKeys: Set<string>,
  options?: { replaceUrl?: boolean }
): void {
  const currentQueryParams = route.snapshot.queryParams as Record<
    string,
    unknown
  >;
  const queryParams = getMergedQueryParams(
    currentQueryParams,
    filterParams,
    filterKeys
  );

  if (areQueryParamsEqual(currentQueryParams, queryParams)) {
    return;
  }

  void router.navigate([], {
    relativeTo: route,
    queryParams,
    ...(options?.replaceUrl ? { replaceUrl: true } : {}),
  });
}

export function getMergedQueryParams(
  currentQueryParams: Record<string, unknown>,
  filterParams: Record<string, string | undefined>,
  filterKeys: Set<string>
): Record<string, string | undefined> {
  const preservedParams: Record<string, string | undefined> = {};

  Object.entries(currentQueryParams).forEach(([key, value]) => {
    if (!filterKeys.has(key) && typeof value === "string" && value) {
      preservedParams[key] = value;
    }
  });

  return {
    ...preservedParams,
    ...filterParams,
  };
}

export function areQueryParamsEqual(
  current: Record<string, unknown>,
  next: Record<string, string | undefined>
): boolean {
  const normalize = (
    params: Record<string, unknown>
  ): Record<string, string> => {
    const normalized: Record<string, string> = {};

    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        normalized[key] = value;
      }
    });

    return normalized;
  };

  const normalizedCurrent = normalize(current);
  const normalizedNext = normalize(next);
  const currentKeys = Object.keys(normalizedCurrent).sort();
  const nextKeys = Object.keys(normalizedNext).sort();

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return currentKeys.every(
    (key, index) =>
      key === nextKeys[index] && normalizedCurrent[key] === normalizedNext[key]
  );
}
