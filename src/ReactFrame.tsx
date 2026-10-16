import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DesignNode, DesignSystem } from '../shared/types';
import { reactExportKey } from '../shared/react-project';
import { reactPreviewDocument } from '../shared/react-preview';
import { setLiveFrame, useIsLiveFrame } from './live-frame';

export default memo(function ReactFrame({ node, system, liveKey, preview, onOpenComponent }: { node: DesignNode; system?: DesignSystem; liveKey?: string; preview?: boolean; onOpenComponent?: (id: string) => void }) {
  const active = useIsLiveFrame(liveKey ?? ''), frame = useRef<HTMLIFrameElement>(null), loads = useRef(0), pendingPick = useRef<string | null>(null);
  const document = useMemo(() => reactPreviewDocument(node, system), [node.react, system?.react, system?.tokens, system?.components]);
  const [blocked, setBlocked] = useState(false);
  useLayoutEffect(() => { loads.current = 0; setBlocked(false); }, [document]);
  useEffect(() => {
    const exit = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow && event.data === 'codex-live-exit') setLiveFrame(null); };
    window.addEventListener('message', exit);
    if (active) frame.current?.focus();
    return () => window.removeEventListener('message', exit);
  }, [active]);
  useEffect(() => {
    const pick = (event: Event) => {
      const request = (event as CustomEvent<{nodeId:string;x:number;y:number}>).detail;
      const element = frame.current;
      if (!onOpenComponent || active || preview || request.nodeId !== node.id || !element) return;
      const { x, y } = request;
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= element.clientWidth || y >= element.clientHeight) return;
      const requestId = crypto.randomUUID(); pendingPick.current = requestId;
      element.contentWindow?.postMessage({ type: 'codex-react-pick', requestId, x, y }, '*');
    };
    const selected = (event: MessageEvent) => {
      if (!onOpenComponent || active || event.source !== frame.current?.contentWindow || !event.data || event.data.type !== 'codex-react-component' || !pendingPick.current || event.data.requestId !== pendingPick.current) return;
      pendingPick.current = null;
      const component = system?.components.find(item => item.nodes.some(child => child.id === item.rootNodeId && child.react && reactExportKey(child.react) === event.data.key));
      if (component) onOpenComponent(component.id);
    };
    window.addEventListener('codex-react-pick', pick); window.addEventListener('message', selected);
    return () => { pendingPick.current = null; window.removeEventListener('codex-react-pick', pick); window.removeEventListener('message', selected); };
  }, [node.id, document, system?.components, active, preview, onOpenComponent]);
  if (blocked) return <div role="alert" className="tw:p-4 tw:text-xs tw:text-red-400">This preview tried to navigate. Edit its source to resume.</div>;
  return <iframe ref={frame} title={node.name} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={document} tabIndex={active || preview ? 0 : -1}
    onLoad={() => { if (++loads.current > 1) { setLiveFrame(null); setBlocked(true); } }}
    className={`tw:block tw:h-full tw:w-full tw:border-0 tw:[color-scheme:normal] ${active || preview ? 'tw:pointer-events-auto!' : 'tw:pointer-events-none'}${active ? ' tw:outline tw:outline-1 tw:-outline-offset-1 tw:outline-[#4c8dff]' : ''}`} />;
});
