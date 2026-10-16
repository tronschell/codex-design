import chatgptLogo from '../assets/chatgpt-logo.png?inline';

export default function ChatGptLogo({ size = 20, label }: { size?: number; label?: string }) {
  return <img src={chatgptLogo} width={size} height={size} alt={label ?? ''} aria-hidden={label ? undefined : true} draggable={false} className="tw:block tw:shrink-0 tw:rounded-full"/>;
}
