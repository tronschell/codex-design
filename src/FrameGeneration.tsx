import { useEffect, useState } from 'react';

const idleAfter = 120_000;

export default function FrameGeneration({ updatedAt }: { updatedAt?: string }) {
  const [waiting, setWaiting] = useState(false), [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const remaining = Math.max(0, (updatedAt ? Date.parse(updatedAt) : 0) + idleAfter - Date.now());
    setWaiting(remaining === 0);
    const timer = remaining ? window.setTimeout(() => setWaiting(true), remaining) : undefined;
    return () => window.clearTimeout(timer);
  }, [updatedAt]);
  useEffect(() => {
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  return <div className={`frame-generation${waiting || hidden ? ' is-idle' : ''}`} aria-live="polite" role="status">
    <span className="frame-generation-wipe"/>
    <span className="frame-generation-status"><span/>{waiting ? 'Waiting for Codex' : 'Building screen'}</span>
  </div>;
}
