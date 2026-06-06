import { useEffect, useState } from 'react';

// Local countdown to a client-domain deadline (epoch ms, i.e. Date.now() + msLeft set at
// the moment a server timer event arrived). Returns the remaining milliseconds, ticking a
// few times a second so the displayed value and any ring stay smooth.
//
// Because the value is derived from the wall clock (not a decrementing counter), it stays
// correct across dropped socket packets, reconnects, and tab backgrounding — on resume the
// next tick simply reads the true remaining time. The server still owns the authoritative
// transition; this is display only.
export function useCountdown(deadline: number | null, tickMs = 200): number {
  const [msLeft, setMsLeft] = useState(() =>
    deadline == null ? 0 : Math.max(0, deadline - Date.now()),
  );

  useEffect(() => {
    if (deadline == null) {
      setMsLeft(0);
      return;
    }

    // Update immediately so a freshly-set deadline doesn't wait a full tick to render.
    setMsLeft(Math.max(0, deadline - Date.now()));

    const id = setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      setMsLeft(remaining);
      if (remaining <= 0) clearInterval(id);
    }, tickMs);

    return () => clearInterval(id);
  }, [deadline, tickMs]);

  return msLeft;
}
