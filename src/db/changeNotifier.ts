type Listener = () => void;

const listeners: Listener[] = [];

export function onDataChange(fn: Listener): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function notifyDataChange(): void {
  for (const fn of listeners) fn();
}
