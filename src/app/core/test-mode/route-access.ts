import {
  DefaultUrlSerializer,
  PRIMARY_OUTLET,
  defaultUrlMatcher,
  type Route,
  type Routes,
  type UrlSegment,
  type UrlSegmentGroup,
} from "@angular/router";
import type { RoleName, RouteWithFallbackData } from "@core/models";

const DASHBOARD = "/driver-dashboard";
const serializer = new DefaultUrlSerializer();

function matchRoutes(routes: Routes, segments: UrlSegment[], group: UrlSegmentGroup): Route[] | null {
  for (const route of routes) {
    if (route.outlet && route.outlet !== PRIMARY_OUTLET) continue;

    let consumed: UrlSegment[];
    if (route.path === "**") {
      consumed = segments;
    } else if (route.path === "") {
      if (route.pathMatch === "full" && segments.length > 0) continue;
      consumed = [];
    } else {
      const match = (route.matcher ?? defaultUrlMatcher)(segments, group, route);
      if (!match) continue;
      consumed = match.consumed;
    }

    const remaining = segments.slice(consumed.length);
    if (route.redirectTo !== undefined) return [route];
    const children = route.children && matchRoutes(route.children, remaining, group);
    if (children) return [route, ...children];
    if (remaining.length === 0 && (!route.children || Boolean(route.component || route.loadComponent))) {
      return [route];
    }
  }
  return null;
}

export function validateRedirectPath(url: string): string {
  // eslint-disable-next-line no-control-regex -- intentionally reject ASCII control characters
  if (!url || url !== url.trim() || /[\u0000-\u001f\u007f\\]/.test(url)) {
    throw new Error("Test mode redirectTo must be a valid root-relative path");
  }
  if (!url.startsWith("/") || url.startsWith("//")) {
    throw new Error("Test mode redirectTo must start with a single '/'");
  }
  const suffixIndex = url.search(/[?#]/);
  const pathname = suffixIndex === -1 ? url : url.slice(0, suffixIndex);
  if (pathname.includes("//")) {
    throw new Error("Test mode redirectTo must not contain empty path segments");
  }
  let tree: ReturnType<DefaultUrlSerializer["parse"]>;
  try {
    tree = serializer.parse(url);
  } catch {
    throw new Error("Test mode redirectTo could not be parsed as an application route");
  }
  const parsedRoot = tree.root;
  const childOutlets = Object.keys(parsedRoot.children);
  if (childOutlets.some((outlet) => outlet !== PRIMARY_OUTLET)) {
    throw new Error("Test mode redirectTo must target the primary route outlet");
  }
  const primary = parsedRoot.children[PRIMARY_OUTLET];
  if (primary?.hasChildren()) {
    throw new Error("Test mode redirectTo must not contain auxiliary route outlets");
  }
  const serializedPrimary = primary ? `/${primary.toString()}` : "/";
  const normalizedPrimary = serializedPrimary.length > 1 ? serializedPrimary.replace(/\/+$/, "") : "/";
  const expectedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
  if (normalizedPrimary !== expectedPath) {
    throw new Error("Test mode redirectTo contains unsupported route syntax");
  }
  if (suffixIndex !== -1) {
    const suffix = url.slice(suffixIndex);
    const hashIndex = suffix.indexOf("#");
    const rawQuery = hashIndex === -1
      ? (suffix.startsWith("?") ? suffix.slice(1) : null)
      : (suffix.startsWith("?") ? suffix.slice(1, hashIndex) : null);
    const rawFragment = hashIndex === -1 ? null : suffix.slice(hashIndex + 1);
    if (rawQuery !== null) {
      if (rawQuery.length === 0) {
        throw new Error("Test mode redirectTo query string must not be empty");
      }
      const expectedParams = new Map<string, string[]>();
      for (const pair of rawQuery.split("&")) {
        if (!pair) {
          throw new Error("Test mode redirectTo contains an empty query parameter");
        }
        const eqIndex = pair.indexOf("=");
        const rawKey = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
        const rawVal = eqIndex === -1 ? "" : pair.slice(eqIndex + 1);
        if (!rawKey) {
          throw new Error("Test mode redirectTo contains a query parameter without a name");
        }
        let decodedKey: string;
        let decodedVal: string;
        try {
          decodedKey = decodeURIComponent(rawKey.replace(/\+/g, "%20"));
          decodedVal = decodeURIComponent(rawVal.replace(/\+/g, "%20"));
        } catch {
          throw new Error("Test mode redirectTo contains invalid percent-encoding in query string");
        }
        const values = expectedParams.get(decodedKey) ?? [];
        values.push(decodedVal);
        expectedParams.set(decodedKey, values);
      }
      const parsedKeys = Object.keys(tree.queryParams);
      if (parsedKeys.length !== expectedParams.size) {
        throw new Error("Test mode redirectTo query string was partially discarded by Angular");
      }
      for (const [key, values] of expectedParams) {
        const parsed = tree.queryParams[key];
        const expected = values.length === 1 ? values[0] : values;
        if (JSON.stringify(parsed) !== JSON.stringify(expected)) {
          throw new Error("Test mode redirectTo query string was rewritten by Angular");
        }
      }
    }
    if (rawFragment !== null) {
      let decodedFragment: string;
      try {
        decodedFragment = decodeURIComponent(rawFragment);
      } catch {
        throw new Error("Test mode redirectTo contains invalid percent-encoding in fragment");
      }
      if (tree.fragment !== decodedFragment) {
        throw new Error("Test mode redirectTo fragment was discarded or rewritten by Angular");
      }
    }
  }
  return url;
}

export function normalizePath(url: string): string {
  const suffixIndex = url.search(/[?#]/);
  const rawPath = suffixIndex === -1 ? url : url.slice(0, suffixIndex);
  const trimmed = rawPath.replace(/\/+$/, "");
  const singleLeading = trimmed.replace(/^\/+/, "/");
  const path = singleLeading.startsWith("/") ? singleLeading : `/${singleLeading}`;
  const suffix = suffixIndex === -1 ? "" : url.slice(suffixIndex);
  return path + suffix;
}

/** Check all primary route ancestors, including guards Angular may reuse across siblings. */
export function resolveAuthorizedDestination(routes: Routes, desiredUrl: string, role: RoleName): string {
  const visited = new Set<string>();
  let url = normalizePath(desiredUrl);

  while (!visited.has(url)) {
    visited.add(url);
    let group: UrlSegmentGroup | undefined;
    try {
      const root = serializer.parse(url).root;
      if (Object.keys(root.children).some((outlet) => outlet !== PRIMARY_OUTLET)) return DASHBOARD;
      group = root.children[PRIMARY_OUTLET];
    } catch {
      return DASHBOARD;
    }
    if (group?.hasChildren()) return DASHBOARD;

    const segments = group?.segments ?? [];
    const chain = matchRoutes(routes, segments, group ?? serializer.parse("/").root);
    if (!chain) return DASHBOARD;

    const blocked = chain.find((route) => {
      const roles = route.data?.["roles"] as readonly RoleName[] | undefined;
      return roles?.length && !roles.includes(role);
    });
    if (blocked) {
      const fallback = (blocked.data as RouteWithFallbackData | undefined)?.fallbackCommands;
      url = fallback?.length ? normalizePath(fallback.join("/")) : DASHBOARD;
      continue;
    }

    const redirect = chain.at(-1)?.redirectTo;
    if (typeof redirect === "string") {
      url = normalizePath(redirect);
      continue;
    }
    return url;
  }

  return DASHBOARD;
}
