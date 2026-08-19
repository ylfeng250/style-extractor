export const EXTRACT_ATTR = 'data-se-extract-id';

export function createExtractId(): string {
  return crypto.randomUUID();
}

export function markElement(element: Element, extractId: string): void {
  element.setAttribute(EXTRACT_ATTR, extractId);
}

export function unmarkElement(element: Element): void {
  element.removeAttribute(EXTRACT_ATTR);
}

export function extractMarkerSelector(extractId: string): string {
  return `[${EXTRACT_ATTR}="${extractId}"]`;
}

export function stripExtractMarker(html: string): string {
  return html.replace(new RegExp(`\\s*${EXTRACT_ATTR}="[^"]*"`, 'g'), '');
}
