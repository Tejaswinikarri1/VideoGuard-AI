import { avatarColor, initials } from '../fmt';

export function Avatar({ name, size = 36 }: { name?: string; size?: number }) {
  return <span className="avatar" aria-hidden style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.36 }}>{initials(name)}</span>;
}
