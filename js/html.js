/**
 * @param{string} id
 * @return {HTMLElement}
 */
export function getHTMLElement(id) {
  const inputEl = document.getElementById(id);
  if (inputEl instanceof HTMLElement) {
    return inputEl;
  }
  throw new Error(`Input ${id} not found or not HTMLElement.`);
}

/**
 * @param{string} id
 * @return {HTMLInputElement}
 */
export function getHTMLInputElement(id) {
  const inputEl = document.getElementById(id);
  if (inputEl instanceof HTMLInputElement) {
    return inputEl;
  }
  throw new Error(`Input ${id} not found or not HTMLInputElement.`);
}
