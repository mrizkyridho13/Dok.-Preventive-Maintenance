/**
 * Lightweight priority stack for Android hardware Back button handling.
 * Ensures topmost open modals, previews, or popups close in LIFO/priority order
 * before prompting the user to exit the app.
 */
interface BackHandlerEntry {
  id: string;
  priority: number;
  order: number;
  onBack: () => void;
}

let nextOrder = 1;
const activeHandlers: BackHandlerEntry[] = [];

export function registerBackHandler(
  id: string,
  priority: number,
  onBack: () => void
): () => void {
  const existingIdx = activeHandlers.findIndex((entry) => entry.id === id);
  if (existingIdx !== -1) {
    activeHandlers.splice(existingIdx, 1);
  }

  activeHandlers.push({
    id,
    priority,
    order: nextOrder++,
    onBack,
  });

  return () => {
    const idx = activeHandlers.findIndex((entry) => entry.id === id);
    if (idx !== -1) {
      activeHandlers.splice(idx, 1);
    }
  };
}

export function handleTopBackAction(): boolean {
  if (activeHandlers.length === 0) {
    return false;
  }

  let top = activeHandlers[0];
  for (let i = 1; i < activeHandlers.length; i++) {
    const candidate = activeHandlers[i];
    if (
      candidate.priority > top.priority ||
      (candidate.priority === top.priority && candidate.order > top.order)
    ) {
      top = candidate;
    }
  }

  top.onBack();
  return true;
}
