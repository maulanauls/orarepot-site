'use client';

import { forwardRef } from 'react';
import { avatarToneClass, isStockAvatar, nameInitials } from '@/lib/initials';
import { cn } from '@/lib/utils';

type Props = {
  name?: string | null;
  imageUrl?: string | null;
  className?: string;
  sizeClassName?: string;
};

export const UserAvatar = forwardRef<HTMLSpanElement, Props>(function UserAvatar(
  { name, imageUrl, className, sizeClassName = 'size-9' },
  ref,
) {
  const label = name?.trim() || '';
  const initials = nameInitials(label);
  const custom = imageUrl && !isStockAvatar(imageUrl) ? imageUrl : null;

  return (
    <span
      ref={ref}
      className={cn(
        sizeClassName,
        'rounded-full inline-flex items-center justify-center overflow-hidden shrink-0 select-none',
        custom ? 'bg-muted' : cn('text-white font-semibold leading-none', avatarToneClass(label)),
        className,
      )}
      aria-hidden={!label}
      aria-label={label || undefined}
    >
      {custom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={custom} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-[0.72em] tracking-wide">{initials}</span>
      )}
    </span>
  );
});
