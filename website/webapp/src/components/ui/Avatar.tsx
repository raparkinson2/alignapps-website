'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Player } from '@/lib/types';
import { getPlayerInitials } from '@/lib/types';

interface AvatarProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
}

const AVATAR_COLORS = [
  'bg-cyan-600',
  'bg-purple-600',
  'bg-emerald-600',
  'bg-orange-600',
  'bg-rose-600',
  'bg-blue-600',
];

function hashPlayerId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

// Only treat avatar as a valid image if it looks like a URL
function isValidImageUrl(avatar: string): boolean {
  return avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('/');
}

export default function Avatar({ player, size = 'md' }: AvatarProps) {
  const colorClass = AVATAR_COLORS[hashPlayerId(player.id) % AVATAR_COLORS.length];
  const initials = getPlayerInitials(player);
  const [imgError, setImgError] = useState(false);

  const showImage = player.avatar && isValidImageUrl(player.avatar) && !imgError;

  if (showImage) {
    return (
      <div className={cn('rounded-full overflow-hidden shrink-0', sizeClasses[size])}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={player.avatar}
          alt={`${player.firstName} ${player.lastName}`}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-full shrink-0 flex items-center justify-center font-semibold text-white',
        sizeClasses[size],
        colorClass
      )}
      title={`${player.firstName} ${player.lastName}`}
    >
      {initials}
    </div>
  );
}
