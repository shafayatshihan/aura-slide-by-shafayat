// Tiny app-wide event bus. emit('step:change', {...}); const off = on('step:change', e => ...); off();
export const bus = new EventTarget();
export const emit = (type, detail = {}) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export function on(type, fn) {
  const h = e => fn(e.detail, e);
  bus.addEventListener(type, h);
  return () => bus.removeEventListener(type, h);
}
