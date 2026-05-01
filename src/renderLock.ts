type Listener = (locked: boolean) => void;

const listeners = new Set<Listener>();
let locked = false;

export function isRenderLocked() {
  return locked;
}

export function setRenderLocked(value: boolean) {
  if (locked === value) return;
  locked = value;
  for (const l of listeners) l(value);
}

export function subscribeRenderLock(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
