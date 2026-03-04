export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  children?: (Node | string)[],
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, value);
    }
  }
  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }
  return element;
}

export function svgIcon(svgContent: string, className?: string): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = className ? `gallop-icon ${className}` : 'gallop-icon';
  wrapper.innerHTML = svgContent;
  wrapper.setAttribute('aria-hidden', 'true');
  return wrapper;
}
