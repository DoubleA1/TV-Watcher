/**
 * Links for the title overlay.
 *
 * The sheet is a query parameter on whichever of the three pages you are
 * already on, so opening and closing it has to preserve everything else in
 * the URL — a search term, a taste view — rather than resetting it.
 */
export function sheetBase(pathname: string, params: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key === 'title' || value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) query.append(key, v)
    } else {
      query.set(key, value)
    }
  }
  const qs = query.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

/** Href that opens the sheet for a title, keeping the rest of the URL. */
export function sheetHref(base: string, titleId: string): string {
  return `${base}${base.includes('?') ? '&' : '?'}title=${encodeURIComponent(titleId)}`
}
