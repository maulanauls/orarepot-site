'use client';

import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { avatarToneClass, isStockAvatar, nameInitials } from '@/lib/initials';
import { cn } from '@/lib/utils';

type Props = {
  name?: string | null;
  imageUrl?: string | null;
  className?: string;
  sizeClassName?: string;
} & Omit<ComponentPropsWithoutRef<'span'>, 'children'>;

export const UserAvatar = forwardRef<HTMLSpanElement, Props>(function UserAvatar(
  { name, imageUrl, className, sizeClassName = 'size-9', ...props },
  ref,
) {
  const label = name?.trim() || '';
  const initials = nameInitials(label);
  const custom = imageUrl && !isStockAvatar(imageUrl) ? imageUrl : null;

  return (
    <span
      ref={ref}
      {...props}
      className={cn(
        sizeClassName,
        'rounded-full inline-flex items-center justify-center overflow-hidden shrink-0 select-none',
        custom ? 'bg-muted' : cn('text-white font-semibold leading-none', avatarToneClass(label)),
        className,
      )}
      aria-hidden={props['aria-hidden'] ?? (!label ? true : undefined)}
      aria-label={props['aria-label'] ?? (label || undefined)}
    >
      {custom ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={custom} alt="" className="size-full object-cover pointer-events-none" />
      ) : (
        <span className="text-[0.72em] tracking-wide pointer-events-none">{initials}</span>
      )}
    </span>
  );
});
