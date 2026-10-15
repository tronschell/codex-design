import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, ImagePlus, Pause, Play } from 'lucide-react';
import { shortcut } from './shortcuts';
import type { ShaderConfig } from '../shared/types';
import { defaultShader, shaderPresets } from '../shared/shaders';
import ShaderNode from './ShaderNode';

const palettes = [
  ['#160c2d', '#813aff', '#ff629a', '#ffe0b2'],
  ['#062a34', '#079e91', '#9de8bc', '#eaf6cc'],
  ['#351726', '#e86c49', '#ffb96b', '#ffe0aa'],
  ['#13234e', '#3478eb', '#9abefa', '#e0edff'],
  ['#17191e', '#687078', '#c4cbc7', '#f2f2e8'],
  ['#29294a', '#8679bb', '#dba3c7', '#ffe6d2'],
];

function randomLooks() {
  return Array.from({ length: 2 }, (_, variation) => shaderPresets.filter(preset => preset.id !== 'custom').map(preset => ({
    ...preset, id: `${preset.id}-${variation}`,
    shader: { ...defaultShader(preset.id), colors: [...palettes[Math.floor(Math.random() * palettes.length)]], seed: Math.floor(Math.random() * 101), scale: .65 + Math.random() * 1.5, speed: .4 + Math.random(), animate: true },
  }))).flat();
}

export default function InsertMenu({ onPickMedia, onAddShader, disabled }: { onPickMedia: () => void; onAddShader: (shader: ShaderConfig) => void; disabled: boolean }) {
  const rail = useRef<HTMLDivElement>(null), positioned = useRef(false);
  const [looks] = useState(randomLooks), [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
  useEffect(() => {
    const viewport = rail.current;
    if (!viewport) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const span = viewport.scrollWidth / 2;
    if (!positioned.current) { viewport.scrollLeft = motion.matches ? 0 : span; positioned.current = true; }
    let frame = 0, previous = 0, visible = false;
    const advance = (now: number) => {
      viewport.scrollLeft -= previous ? Math.min(now - previous, 64) * .028 : 0;
      if (viewport.scrollLeft <= 0) viewport.scrollLeft += span;
      previous = now;
      frame = requestAnimationFrame(advance);
    };
    const sync = () => {
      cancelAnimationFrame(frame); previous = 0;
      if (playing && !hovered && !focused && !disabled && visible && !document.hidden && !motion.matches) frame = requestAnimationFrame(advance);
    };
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); sync(); });
    observer.observe(viewport);
    document.addEventListener('visibilitychange', sync); motion.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      document.removeEventListener('visibilitychange', sync); motion.removeEventListener('change', sync);
    };
  }, [playing, hovered, focused, disabled]);
  const move = (direction: number) => {
    const viewport = rail.current;
    if (!viewport) return;
    setPlaying(false);
    const span = viewport.scrollWidth / 2, distance = viewport.clientWidth * .7;
    if (direction < 0 && viewport.scrollLeft < distance) viewport.scrollLeft += span;
    if (direction > 0 && viewport.scrollLeft > span) viewport.scrollLeft -= span;
    viewport.scrollBy({ left: direction * distance, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <div className="dropdown insert-menu" aria-label="Insert media and effects" onWheel={event => event.stopPropagation()} onKeyDown={event => { if (event.key !== 'Escape') event.stopPropagation(); }}>
    <button className="dropdown-item" disabled={disabled} onClick={onPickMedia}><ImagePlus size={17}/><span>Image or video…</span><kbd>{shortcut('Ctrl+I')}</kbd></button>
    <div className="menu-divider"/>
    <div className="shader-carousel" role="region" aria-roledescription="carousel" aria-label="Shaders.com effects" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="menu-heading"><span>Shaders.com effects</span><div className="shader-carousel-controls">
        <button className="icon-button" title="Previous shader looks" aria-label="Previous shader looks" disabled={disabled} onClick={() => move(-1)}><ChevronLeft/></button>
        <button className="icon-button shader-carousel-toggle" title={playing ? 'Pause automatic scrolling' : 'Resume automatic scrolling'} aria-label={playing ? 'Pause automatic scrolling' : 'Resume automatic scrolling'} disabled={disabled} onClick={() => setPlaying(value => !value)}>{playing ? <Pause/> : <Play/>}</button>
        <button className="icon-button" title="Next shader looks" aria-label="Next shader looks" disabled={disabled} onClick={() => move(1)}><ChevronRight/></button>
      </div></div>
      <div ref={rail} className="shader-carousel-viewport" aria-live="off" onPointerDown={() => setPlaying(false)}>
        {[0, 1].map(copy => <div key={copy} className="shader-carousel-set" aria-hidden={copy === 1 ? true : undefined}>
          {looks.map((look, index) => <button key={look.id} className="shader-option" tabIndex={copy ? -1 : 0} aria-label={`Add ${look.name}, variation ${index + 1}`} disabled={disabled} onClick={() => onAddShader({ ...look.shader, animate: false })}>
            <span className="shader-thumbnail" aria-hidden="true"><ShaderNode shader={look.shader} name={look.name}/></span>
            <span><strong>{look.name}</strong><small>{look.description.split(' · ')[0]}</small></span>
          </button>)}
        </div>)}
      </div>
    </div>
    <a className="dropdown-item" style={{textDecoration:'none'}} href="https://shaders.com/" target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/><span>Browse shaders.com</span></a>
  </div>;
}
