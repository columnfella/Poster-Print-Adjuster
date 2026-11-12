/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

/**
 * Hook for smooth modal enter & exit transitions.
 * Keeps the modal mounted in the DOM until the fade-out/scale-down animation completes.
 *
 * @param isOpen Whether the modal is open in state
 * @param durationMs Animation transition duration in milliseconds (default: 280ms)
 * @returns { isRendered, isVisible }
 */
export function useModalTransition(isOpen: boolean, durationMs: number = 280) {
  const [isRendered, setIsRendered] = useState<boolean>(isOpen);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let raf1: number;
    let raf2: number;

    if (isOpen) {
      setIsRendered(true);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      timer = setTimeout(() => {
        setIsRendered(false);
      }, durationMs);
    }

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isOpen, durationMs]);

  return { isRendered, isVisible };
}
