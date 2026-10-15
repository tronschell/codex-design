import { useEffect, useRef, useState } from 'react';

const idleAfter = 120_000;

export default function FrameGeneration({ updatedAt }: { updatedAt?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
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
  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d');
    if (!element || !context || waiting || hidden) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const glyphs = '.:+=*#%@<>/\\01';
    const started = performance.now();
    let width = 0, height = 0, frame = 0, lastDraw = 0, visible = false;
    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      const progress = motion.matches ? .5 : ((now - started) % 2200) / 2200;
      const eased = progress < .5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
      const band = Math.max(36, Math.min(100, width * .14));
      const reach = band * 2 + height * .14;
      const center = -reach + eased * (width + reach * 2);
      const tick = motion.matches ? 0 : Math.floor((now - started) / 100);
      for (let row = 0, y = 7; y < height; row++, y += 14) {
        const drift = Math.sin(y * .035 + tick * .09) * 13 + Math.sin(y * .013 - tick * .07) * 9;
        const rowCenter = center - (y - height / 2) * .27 + drift;
        const first = Math.max(0, Math.floor((rowCenter - band * 2) / 9));
        const end = Math.min(Math.ceil(width / 9), Math.ceil((rowCenter + band * 2) / 9));
        for (let column = first; column < end; column++) {
          const seed = Math.abs(Math.sin(column * 127.1 + row * 311.7) * 43758.5453);
          const random = seed - Math.floor(seed);
          const distance = Math.abs(column * 9 - rowCenter + (random - .5) * 22);
          const strength = Math.max(0, 1 - distance / band);
          const straggler = random > .965 && distance < band * 1.9;
          if ((!strength || random > .2 + strength * .8) && !straggler) continue;
          const light = strength > .8 ? 255 : Math.round(100 + strength * 140 + Math.sin(seed + tick * .4) * 12);
          context.fillStyle = `rgb(${light},${light},${light})`;
          context.fillText(glyphs[(Math.floor(seed + tick * (.6 + random)) + row) % glyphs.length], column * 9, y);
        }
      }
    };
    const animate = (now: number) => {
      if (now - lastDraw >= 1000 / 30) { draw(now); lastDraw = now; }
      frame = requestAnimationFrame(animate);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      if (!visible || document.hidden) return;
      draw(performance.now());
      if (!motion.matches) frame = requestAnimationFrame(animate);
    };
    const resize = new ResizeObserver(() => {
      // Bound work and bitmap size even for very large design frames.
      const scale = Math.min(1, 2400 / Math.max(element.clientWidth, element.clientHeight, 1));
      width = element.clientWidth * scale; height = element.clientHeight * scale;
      const ratio = Math.min(devicePixelRatio || 1, 1.5, 2048 / Math.max(width, height, 1));
      element.width = Math.max(1, Math.round(width * ratio)); element.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      context.textBaseline = 'middle';
      sync();
    });
    const intersection = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); sync(); });
    resize.observe(element); intersection.observe(element);
    motion.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect(); intersection.disconnect();
      motion.removeEventListener('change', sync);
    };
  }, [waiting, hidden]);
  return <div className={`frame-generation${waiting || hidden ? ' is-idle' : ''}`} aria-live="polite" role="status">
    <canvas ref={canvas} className="frame-generation-wipe" aria-hidden="true"/>
    <span className="frame-generation-status"><span/>{waiting ? 'Waiting for Codex' : 'Building screen'}</span>
  </div>;
}
