'use client';

import React, { useState, useCallback } from 'react';
import { Trash2, Plus, Send, CheckCircle, Circle, Inbox, ChevronRight, Users } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import {
  pushDirectMessageToSupabase,
  markDirectMessageReadInSupabase,
  deleteDirectMessageFromSupabase,
} from '@/lib/realtime-sync';
import { generateId, cn } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import { usePermissions } from '@/hooks/usePermissions';
import type { DirectMessage, Player } from '@/lib/types';

// ─── Date Formatting ─────────────────────────────────────────────────────────

function formatMessageDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Today — show time
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatMessageDateFull(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return isoString;
  }
}

// ─── Initials Avatar (for cases without a player object) ──────────────────────

function InitialsAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2
    ? `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  // Simple hash for consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const colors = ['bg-cyan-600', 'bg-purple-600', 'bg-emerald-600', 'bg-orange-600', 'bg-rose-600', 'bg-blue-600'];
  const colorClass = colors[hash % colors.length];

  return (
    <div
      className={cn(
        'rounded-full shrink-0 flex items-center justify-center font-semibold text-white',
        sizeClasses[size],
        colorClass
      )}
    >
      {initials}
    </div>
  );
}

// ─── Message Row ──────────────────────────────────────────────────────────────

interface MessageRowProps {
  message: DirectMessage;
  isUnread: boolean;
  senderPlayer: Player | null;
  isAdmin: boolean;
  isSentTab: boolean;
  currentPlayerId: string;
  onOpen: (msg: DirectMessage) => void;
  onDelete: (msg: DirectMessage) => void;
}

function MessageRow({
  message,
  isUnread,
  senderPlayer,
  isAdmin,
  isSentTab,
  currentPlayerId,
  onOpen,
  onDelete,
}: MessageRowProps) {
  const canDelete = isAdmin || (!isSentTab && message.recipientIds.includes(currentPlayerId));

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors',
        isUnread && !isSentTab
          ? 'bg-[#0f1a2e] border-[#67e8f9]/20 hover:border-[#67e8f9]/40'
          : 'bg-[#0f1a2e] border-white/[0.07] hover:border-white/20'
      )}
      onClick={() => onOpen(message)}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {senderPlayer ? (
          <Avatar player={senderPlayer} size="md" />
        ) : (
          <InitialsAvatar name={message.senderName || 'Unknown'} size="md" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <span className={cn('text-sm font-semibold truncate', isUnread && !isSentTab ? 'text-slate-100' : 'text-slate-200')}>
            {isSentTab ? `To: ${message.recipientIds.length} recipient${message.recipientIds.length !== 1 ? 's' : ''}` : message.senderName}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-slate-500">{formatMessageDate(message.createdAt)}</span>
            {isUnread && !isSentTab && (
              <div className="w-2 h-2 rounded-full bg-[#67e8f9] shrink-0" />
            )}
          </div>
        </div>

        <p className={cn('text-sm font-medium truncate mb-0.5', isUnread && !isSentTab ? 'text-slate-200' : 'text-slate-300')}>
          {message.subject}
        </p>
        <p className="text-xs text-slate-500 truncate leading-relaxed">
          {message.body}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 self-center">
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(message);
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
            aria-label="Delete message"
          >
            <Trash2 size={15} />
          </button>
        )}
        <ChevronRight size={15} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
      </div>
    </div>
  );
}

// ─── Compose Modal ─────────────────────────────────────────────────────────────

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  currentPlayerId: string;
  activeTeamId: string;
  senderName: string;
  onSend: (msg: DirectMessage) => void;
}

function ComposeModal({
  isOpen,
  onClose,
  players,
  currentPlayerId,
  activeTeamId,
  senderName,
  onSend,
}: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const eligiblePlayers = players.filter((p) => p.id !== currentPlayerId && p.status === 'active');
  const allSelected = eligiblePlayers.length > 0 && selectedIds.length === eligiblePlayers.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligiblePlayers.map((p) => p.id));
    }
  };

  const handleTogglePlayer = (playerId: string) => {
    setSelectedIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || selectedIds.length === 0) return;
    setSending(true);

    const msg: DirectMessage = {
      id: generateId(),
      teamId: activeTeamId,
      senderId: currentPlayerId,
      senderName,
      recipientIds: selectedIds,
      subject: subject.trim(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
      readBy: [currentPlayerId],
    };

    await pushDirectMessageToSupabase(msg);
    onSend(msg);
    setSending(false);

    // Reset form
    setSubject('');
    setBody('');
    setSelectedIds([]);
    onClose();
  };

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && selectedIds.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Message" size="lg">
      <div className="space-y-4">
        {/* Subject */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter subject..."
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/30 focus:border-[#67e8f9]/30 text-sm"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={5}
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/30 focus:border-[#67e8f9]/30 text-sm resize-none leading-relaxed"
          />
        </div>

        {/* Recipients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Recipients ({selectedIds.length} selected)
            </label>
            <button
              onClick={handleSelectAll}
              className="text-xs text-[#67e8f9] hover:text-[#67e8f9]/80 transition-colors font-medium"
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-white/[0.07] p-2">
            {eligiblePlayers.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-4">No other players on this team</p>
            ) : (
              eligiblePlayers.map((player) => {
                const isSelected = selectedIds.includes(player.id);
                return (
                  <button
                    key={player.id}
                    onClick={() => handleTogglePlayer(player.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left',
                      isSelected ? 'bg-[#67e8f9]/10' : 'hover:bg-white/[0.04]'
                    )}
                  >
                    <Avatar player={player} size="sm" />
                    <span className="flex-1 text-sm text-slate-200">
                      {player.firstName} {player.lastName}
                    </span>
                    {isSelected ? (
                      <CheckCircle size={16} className="text-[#67e8f9] shrink-0" />
                    ) : (
                      <Circle size={16} className="text-slate-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend || sending}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all',
            canSend && !sending
              ? 'bg-[#67e8f9] text-[#080c14] hover:bg-[#67e8f9]/90'
              : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
          )}
        >
          {sending ? (
            <div className="w-4 h-4 rounded-full border-2 border-[#080c14]/30 border-t-[#080c14] animate-spin" />
          ) : (
            <>
              <Send size={15} />
              Send Message
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  message: DirectMessage | null;
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  isAdmin: boolean;
  isSentMessage: boolean;
  currentPlayerId: string;
  onDelete: (msg: DirectMessage) => void;
}

function DetailModal({
  message,
  isOpen,
  onClose,
  players,
  isAdmin,
  isSentMessage,
  currentPlayerId,
  onDelete,
}: DetailModalProps) {
  if (!message) return null;

  const senderPlayer = players.find((p) => p.id === message.senderId) ?? null;
  const canDelete = isAdmin || (!isSentMessage && message.recipientIds.includes(currentPlayerId));

  const handleDelete = () => {
    onDelete(message);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={message.subject} size="lg">
      <div className="space-y-5">
        {/* Sender info */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/[0.07]">
          <div className="shrink-0">
            {senderPlayer ? (
              <Avatar player={senderPlayer} size="lg" />
            ) : (
              <InitialsAvatar name={message.senderName || 'Unknown'} size="lg" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">{message.senderName}</p>
            <p className="text-xs text-slate-400 mt-0.5">{formatMessageDateFull(message.createdAt)}</p>
          </div>

          {canDelete && (
            <button
              onClick={handleDelete}
              className="ml-auto p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
              aria-label="Delete message"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {message.body}
        </div>

        {/* Recipients (shown for sent messages) */}
        {isSentMessage && message.recipientIds.length > 0 && (
          <div className="pt-4 border-t border-white/[0.07]">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-slate-400" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Recipients ({message.recipientIds.length})
              </p>
            </div>
            <div className="space-y-2">
              {message.recipientIds.map((recipientId) => {
                const player = players.find((p) => p.id === recipientId);
                const hasRead = message.readBy.includes(recipientId);
                return (
                  <div key={recipientId} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03]">
                    {player ? (
                      <Avatar player={player} size="sm" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 flex items-center justify-center">
                        <span className="text-xs text-slate-400">?</span>
                      </div>
                    )}
                    <span className="flex-1 text-sm text-slate-300">
                      {player ? `${player.firstName} ${player.lastName}` : 'Unknown Player'}
                    </span>
                    {hasRead ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle size={13} />
                        Read
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Circle size={13} />
                        Unread
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Read status for inbox messages — just show that you've read it */}
        {!isSentMessage && (
          <div className="pt-4 border-t border-white/[0.07]">
            <p className="text-xs text-slate-500">
              {message.readBy.includes(currentPlayerId) ? 'You have read this message.' : 'Marked as read.'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: 'inbox' | 'sent' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-4">
        <Inbox size={24} className="text-slate-500" />
      </div>
      <p className="text-slate-300 font-medium text-sm mb-1">
        {tab === 'inbox' ? 'No messages yet' : 'No sent messages'}
      </p>
      <p className="text-slate-500 text-xs max-w-xs">
        {tab === 'inbox'
          ? 'Messages from your team admins will appear here.'
          : 'Messages you send to players will appear here.'}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const directMessages = useTeamStore((s) => s.directMessages);
  const players = useTeamStore((s) => s.players);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const addDirectMessage = useTeamStore((s) => s.addDirectMessage);
  const markDirectMessageRead = useTeamStore((s) => s.markDirectMessageRead);
  const removeDirectMessage = useTeamStore((s) => s.removeDirectMessage);

  const { isAdmin } = usePermissions();

  const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<DirectMessage | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const currentPlayer = players.find((p) => p.id === currentPlayerId) ?? null;
  const senderName = currentPlayer
    ? `${currentPlayer.firstName} ${currentPlayer.lastName}`.trim()
    : 'Admin';

  // Inbox: messages where currentPlayerId is in recipientIds
  const inboxMessages = directMessages
    .filter((m) => currentPlayerId && m.recipientIds.includes(currentPlayerId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Sent: messages where senderId === currentPlayerId
  const sentMessages = directMessages
    .filter((m) => m.senderId === currentPlayerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const displayedMessages = activeTab === 'inbox' ? inboxMessages : sentMessages;

  const handleOpenMessage = useCallback(
    async (msg: DirectMessage) => {
      setSelectedMessage(msg);
      setShowDetail(true);

      // Mark as read if inbox and not already read
      if (
        activeTab === 'inbox' &&
        currentPlayerId &&
        !msg.readBy.includes(currentPlayerId)
      ) {
        markDirectMessageRead(msg.id, currentPlayerId);
        await markDirectMessageReadInSupabase(msg.id, currentPlayerId);
      }
    },
    [activeTab, currentPlayerId, markDirectMessageRead]
  );

  const handleDeleteMessage = useCallback(
    async (msg: DirectMessage) => {
      removeDirectMessage(msg.id);
      await deleteDirectMessageFromSupabase(msg.id);
    },
    [removeDirectMessage]
  );

  const handleSendMessage = useCallback(
    (msg: DirectMessage) => {
      addDirectMessage(msg);
    },
    [addDirectMessage]
  );

  const unreadCount = inboxMessages.filter(
    (m) => currentPlayerId && !m.readBy.includes(currentPlayerId)
  ).length;

  // Determine if selected message is from sent tab
  const isSelectedSent = selectedMessage ? selectedMessage.senderId === currentPlayerId : false;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Messages</h1>
          <p className="text-sm text-slate-400 mt-0.5">Direct messages from your team</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#67e8f9] text-[#080c14] text-sm font-semibold hover:bg-[#67e8f9]/90 transition-all"
          >
            <Plus size={16} />
            Compose
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white/[0.04] rounded-xl p-1">
        <button
          onClick={() => setActiveTab('inbox')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'inbox'
              ? 'bg-[#0f1a2e] text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-300'
          )}
        >
          Inbox
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#67e8f9] text-[#080c14] text-[11px] font-bold">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all',
            activeTab === 'sent'
              ? 'bg-[#0f1a2e] text-slate-100 shadow-sm'
              : 'text-slate-400 hover:text-slate-300'
          )}
        >
          Sent
          {sentMessages.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/10 text-slate-400 text-[11px] font-medium">
              {sentMessages.length}
            </span>
          )}
        </button>
      </div>

      {/* Message List */}
      {displayedMessages.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className="space-y-2">
          {displayedMessages.map((msg) => {
            const senderPlayer = players.find((p) => p.id === msg.senderId) ?? null;
            const isUnread = !!(currentPlayerId && !msg.readBy.includes(currentPlayerId));
            return (
              <MessageRow
                key={msg.id}
                message={msg}
                isUnread={isUnread}
                senderPlayer={senderPlayer}
                isAdmin={isAdmin}
                isSentTab={activeTab === 'sent'}
                currentPlayerId={currentPlayerId ?? ''}
                onOpen={handleOpenMessage}
                onDelete={handleDeleteMessage}
              />
            );
          })}
        </div>
      )}

      {/* Compose Modal */}
      {isAdmin && activeTeamId && currentPlayerId && (
        <ComposeModal
          isOpen={showCompose}
          onClose={() => setShowCompose(false)}
          players={players}
          currentPlayerId={currentPlayerId}
          activeTeamId={activeTeamId}
          senderName={senderName}
          onSend={handleSendMessage}
        />
      )}

      {/* Detail Modal */}
      <DetailModal
        message={selectedMessage}
        isOpen={showDetail}
        onClose={() => {
          setShowDetail(false);
          setSelectedMessage(null);
        }}
        players={players}
        isAdmin={isAdmin}
        isSentMessage={isSelectedSent}
        currentPlayerId={currentPlayerId ?? ''}
        onDelete={handleDeleteMessage}
      />
    </div>
  );
}
