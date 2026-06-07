import type { User } from '@shared/types';
import { Avatar } from './Avatar';

interface Props {
  user: User;
  size?: number;
  className?: string;
}

export function UserAvatar({ user, size = 32, className }: Props) {
  const label = user.displayName || user.username;

  if (user.avatarImage) {
    return (
      <img
        src={user.avatarImage}
        alt={label}
        className={className ?? 'object-cover border border-border rounded-full'}
        style={{ width: size, height: size }}
      />
    );
  }

  if (user.avatarEmoji) {
    return (
      <div
        className={
          className ??
          'flex items-center justify-center border border-border bg-bg-elevated rounded-full'
        }
        style={{ width: size, height: size, fontSize: Math.max(14, size * 0.52) }}
        aria-hidden
      >
        {user.avatarEmoji}
      </div>
    );
  }

  return (
    <Avatar email={user.email} name={label} size={size} className={className} />
  );
}
