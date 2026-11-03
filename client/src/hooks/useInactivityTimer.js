import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook to handle kiosk inactivity timeout:
 * @param {boolean} active - Whether the timer should be running (e.g. only during active user sessions)
 * @param {number} totalTimeoutSeconds - Total idle time before session ends (default 30s)
 * @param {number} warningSeconds - Seconds before end when warning shows (default 5s)
 * @param {function} onTimeout - Callback when timeout expires
 */
export function useInactivityTimer({
  active = true,
  totalTimeoutSeconds = 30,
  warningSeconds = 5,
  onTimeout
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(totalTimeoutSeconds);
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetTimer = useCallback(() => {
    setSecondsRemaining(totalTimeoutSeconds);
    setIsWarningVisible(false);
  }, [totalTimeoutSeconds]);

  useEffect(() => {
    if (!active) {
      setIsWarningVisible(false);
      return;
    }

    // Reset initially when activated
    resetTimer();

    // Listen to all touch/pointer/key events across the window
    const handleUserActivity = () => {
      resetTimer();
    };

    const events = ['pointerdown', 'touchstart', 'click', 'keydown', 'wheel'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Tick every 1 second
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        const next = prev - 1;
        if (next <= warningSeconds && next > 0) {
          setIsWarningVisible(true);
        }
        if (next <= 0) {
          clearInterval(interval);
          setIsWarningVisible(false);
          if (onTimeoutRef.current) {
            onTimeoutRef.current();
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
    };
  }, [active, totalTimeoutSeconds, warningSeconds, resetTimer]);

  return {
    secondsRemaining,
    isWarningVisible,
    resetTimer
  };
}

