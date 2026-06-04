import { initials } from '@/lib/format';

interface Props {
  email: string;
  name?: string;
  url?: string;
  size?: number;
}

export function Avatar({ email, name, url, size = 24 }: Props) {
  const text = initials(name || email || '?');
  const hue = hashString(email || name || '') % 360;

  if (url) {
    return (
      <img
        src={url}
        alt={name || email}
        className="object-cover border border-border"
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center font-mono font-semibold border"
      style={{
        width: size,
        height: size,
        background: `hsl(${hue}, 30%, 14%)`,
        borderColor: `hsl(${hue}, 50%, 28%)`,
        color: `hsl(${hue}, 70%, 70%)`,
        fontSize: Math.max(9, Math.floor(size * 0.42)),
      }}
    >
      {text}
    </div>
  );
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
