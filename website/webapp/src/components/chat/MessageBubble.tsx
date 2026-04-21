'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage, Player } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  sender: Player | null;
  players: Player[];
  currentPlayerId?: string | null;
  onDelete?: (id: string) => void;
  onReply?: (message: ChatMessage) => void;
  onReaction?: (messageId: string, emoji: string) => void;
}

function renderMentions(text: string, players: Player[]): React.ReactNode[] {
  // Match @everyone or @FirstName LastName patterns
  const parts = text.split(/(@everyone|@\w[\w\s]*)/g);
  return parts.map((part, i) => {
    if (part === '@everyone') {
      return (
        <span key={i} className="text-[#67e8f9] font-medium">
          {part}
        </span>
      );
    }
    if (part.startsWith('@')) {
      const nameCandidate = part.slice(1).trim();
      const matchedPlayer = players.find(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase() === nameCandidate.toLowerCase() ||
          p.firstName.toLowerCase() === nameCandidate.toLowerCase()
      );
      if (matchedPlayer) {
        return (
          <span key={i} className="text-[#a78bfa] font-medium">
            {part}
          </span>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

export default function MessageBubble({ message, isOwn, sender, players, currentPlayerId, onDelete, onReply, onReaction }: MessageBubbleProps) {
  const [showCtx, setShowCtx] = useState(false);

  const timeStr = (() => {
    try {
      return format(new Date(message.createdAt), 'h:mm a');
    } catch {
      return '';
    }
  })();

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isOwn || !onDelete) return;
    e.preventDefault();
    setShowCtx(true);
  };

  const reactionEntries = message.reactions
    ? Object.entries(message.reactions).filter(([, ids]) => ids.length > 0)
    : [];

  return (
    <div
      className={cn('flex gap-2 items-end mb-1 group', isOwn ? 'flex-row-reverse' : 'flex-row')}
      onContextMenu={handleContextMenu}
    >
      {/* Avatar for others */}
      {!isOwn && sender && (
        <div className="shrink-0 self-end mb-1">
          <Avatar player={sender} size="sm" />
        </div>
      )}
      {!isOwn && !sender && (
        <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 self-end mb-1" />
      )}

      <div className={cn('max-w-[75%] flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name for others */}
        {!isOwn && (
          <span className="text-xs text-slate-500 px-1">
            {sender ? `${sender.firstName} ${sender.lastName}` : message.senderName ?? 'Unknown'}
          </span>
        )}

        {/* Reply quote preview */}
        {message.replyToSender && (
          <div className={cn(
            'rounded-t-xl px-3 py-1.5 border-l-2 border-[#67e8f9]/50 -mb-1 text-xs',
            isOwn ? 'bg-[#67e8f9]/5' : 'bg-white/[0.03]'
          )}>
            <span className="text-[#67e8f9] font-medium">{message.replyToSender}</span>
            <p className="text-slate-400 truncate max-w-[200px]">{message.replyToText || ''}</p>
          </div>
        )}

        {/* Message bubble */}
        <div className="relative">
          {/* Hover action bar */}
          <div className={cn(
            'absolute -top-8 z-20 flex items-center gap-0.5 bg-[#0d1526] border border-white/10 rounded-lg px-1 py-0.5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity',
            isOwn ? 'right-0' : 'left-0'
          )}>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReaction?.(message.id, emoji)}
                className="hover:bg-white/10 rounded px-1 py-0.5 text-sm transition-colors"
              >
                {emoji}
              </button>
            ))}
            {onReply && (
              <button
                onClick={() => onReply(message)}
                className="hover:bg-white/10 rounded px-1.5 py-0.5 transition-colors text-slate-400 hover:text-[#67e8f9]"
              >
                <Reply size={14} />
              </button>
            )}
            {isOwn && onDelete && (
              <button
                onClick={() => onDelete(message.id)}
                className="hover:bg-rose-500/10 rounded px-1.5 py-0.5 transition-colors text-slate-400 hover:text-rose-400"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div
            className={cn(
              'rounded-2xl px-3.5 py-2.5 text-sm border',
              isOwn
                ? 'bg-[#67e8f9]/10 border-[#67e8f9]/20 text-slate-100'
                : 'bg-[#0f1a2e] border-white/10 text-slate-100',
              message.replyToSender && 'rounded-t-none'
            )}
          >
            {/* GIF */}
            {message.gifUrl && (
              <div className="mb-1 max-w-[240px]">
                <div className="rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.gifUrl}
                    alt="GIF"
                    width={message.gifWidth ?? 240}
                    height={message.gifHeight ?? 160}
                    className="w-full h-auto object-contain"
                    style={{
                      aspectRatio: message.gifWidth && message.gifHeight
                        ? `${message.gifWidth}/${message.gifHeight}`
                        : 'auto',
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 text-right mt-0.5">Powered by <span className="font-bold">GIPHY</span></p>
              </div>
            )}

            {/* Image */}
            {message.imageUrl && (
              <div className="mb-1 rounded-xl overflow-hidden max-w-[240px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.imageUrl}
                  alt="Image"
                  className="w-full h-auto object-cover cursor-pointer"
                  onClick={() => window.open(message.imageUrl, '_blank')}
                />
              </div>
            )}

            {/* Text with mention highlighting */}
            {message.message && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {renderMentions(message.message, players)}
              </p>
            )}

            {/* Timestamp */}
            {timeStr && (
              <p className={cn(
                'text-[10px] text-slate-500 mt-1',
                isOwn ? 'text-right' : 'text-left'
              )}>
                {timeStr}
              </p>
            )}
          </div>
        </div>

        {/* Reaction pills */}
        {reactionEntries.length > 0 && (
          <div className={cn('flex flex-wrap gap-1 mt-0.5', isOwn ? 'justify-end' : 'justify-start')}>
            {reactionEntries.map(([emoji, playerIds]) => {
              const hasReacted = currentPlayerId ? playerIds.includes(currentPlayerId) : false;
              return (
                <button
                  key={emoji}
                  onClick={() => onReaction?.(message.id, emoji)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors',
                    hasReacted
                      ? 'bg-[#67e8f9]/15 border-[#67e8f9]/30 text-[#67e8f9]'
                      : 'bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06]'
                  )}
                >
                  <span>{emoji}</span>
                  <span>{playerIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Context menu (own messages) - legacy fallback */}
      {showCtx && isOwn && onDelete && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowCtx(false)}
          />
          <div className="absolute z-50 bg-[#0f1a2e] border border-white/10 rounded-xl shadow-xl overflow-hidden right-0">
            <button
              onClick={() => { onDelete(message.id); setShowCtx(false); }}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 w-full transition-colors"
            >
              <Trash2 size={14} />
              Delete message
            </button>
          </div>
        </>
      )}
    </div>
  );
}
