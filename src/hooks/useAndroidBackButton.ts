import { useEffect, useId, useRef } from 'react';
import { registerBackHandler } from '../utils/backButtonManager';

/**
 * Registers a modal/overlay close callback with the Android hardware back button stack
 * while `isOpen` is true, and automatically cleans it up on close/unmount.
 */
export function useBackHandler(
  isOpen: boolean,
  onClose: () => void,
  priority: number = 40
) {
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    return registerBackHandler(id, priority, () => {
      onCloseRef.current();
    });
  }, [isOpen, id, priority]);
}
