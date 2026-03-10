'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Calendar, CreditCard, MessageSquare, Trophy, CheckCheck, X } from 'lucide-react';
import { cn, SPORT_EMOJI } from '@/lib/utils';
import { useTeamStore } from '@/lib/store';
import Avatar from '@/components/ui/Avatar';
import type { AppNotification } from '@/lib/types';

const PAGE_TITLES: Record<string, string> = {
  '/app/schedule': 'Schedule',
  '/app/roster': 'Roster',
  '/app/chat': 'Team Chat',
  '/app/photos': 'Photos',
  '/app/payments': 'Payments',
  '/app/stats': 'Stats',
  '/app/records': 'Records',
  '/app/admin': 'Admin',
};

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(path)) return title;
  }
  return 'ALIGN Sports';
}

function notificationIcon(type: AppNotification['type']) {
  switch (type) {
    case 'game_invite':
    case 'game_reminder':
      return <Calendar size={14} className="text-cyan-400" />;
    case 'payment_reminder':
      return <CreditCard size={14} className="text-amber-400" />;
    case 'chat_message':
      return <MessageSquare size={14} className="text-emerald-400" />;
    case 'event_invite':
    case 'practice_invite':
      return <Calendar size={14} className="text-violet-400" />;
    case 'poll':
      return <Trophy size={14} className="text-orange-400" />;
    default:
      return <Bell size={14} className="text-slate-400" />;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const players = useTeamStore((s) => s.players);
  const notifications = useTeamStore((s) => s.notifications);
  const markNotificationRead = useTeamStore((s) => s.markNotificationRead);
  const getUnreadCount = useTeamStore((s) => s.getUnreadCount);

  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const currentPlayer = players.find((p) => p.id === currentPlayerId) ?? null;
  const unreadCount = getUnreadCount();
  const pageTitle = getPageTitle(pathname);
  const emoji = SPORT_EMOJI[teamSettings.sport] ?? '🏆';

  // Filter notifications for current player, newest first
  const myNotifications = notifications
    .filter((n) => n.toPlayerId === currentPlayerId)
    .slice(0, 30);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handleBellClick = () => {
    setOpen((v) => !v);
  };

  const handleNotificationClick = (n: AppNotification) => {
    markNotificationRead(n.id);
    if (n.gameId) {
      router.push(`/app/schedule`);
    } else if (n.eventId) {
      router.push(`/app/schedule`);
    } else if (n.type === 'chat_message') {
      router.push(`/app/chat`);
    } else if (n.type === 'payment_reminder') {
      router.push(`/app/payments`);
    }
    setOpen(false);
  };

  const markAllRead = () => {
    myNotifications.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id));
  };

  return (
    <header className="bg-[#0d1526]/80 backdrop-blur border-b border-white/[0.07] px-4 lg:px-6 h-14 flex items-center gap-4 shrink-0 relative z-30">
      {/* Left: mobile shows team name, desktop shows page title */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-100 text-sm lg:text-base truncate lg:hidden">
          {teamSettings.teamLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <span className="inline-flex items-center gap-2">
              <img src={teamSettings.teamLogo} alt={teamName} className="w-5 h-5 object-contain" />
              {teamName}
            </span>
          ) : (
            <span>{emoji} {teamName}</span>
          )}
        </p>
        <p className="hidden lg:block font-semibold text-slate-100">{pageTitle}</p>
      </div>

      {/* Right: notification bell + avatar */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          ref={bellRef}
          onClick={handleBellClick}
          className={cn(
            'relative p-2 rounded-xl transition-colors',
            open
              ? 'text-[#67e8f9] bg-[#67e8f9]/15'
              : unreadCount > 0
              ? 'text-[#67e8f9] bg-[#67e8f9]/10 hover:bg-[#67e8f9]/15'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
          )}
          aria-label="Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[#67e8f9] text-[#080c14] text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Current player avatar */}
        {currentPlayer && (
          <Avatar player={currentPlayer} size="sm" />
        )}
      </div>

      {/* Notifications panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute top-[calc(100%+4px)] right-4 lg:right-6 w-80 bg-[#0d1526] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-[#67e8f9]/15 text-[#67e8f9] text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#67e8f9] transition-colors px-2 py-1 rounded-lg hover:bg-[#67e8f9]/10"
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-white/[0.05]"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[min(400px,60vh)]">
            {myNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center">
                  <Bell size={18} className="text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm">No notifications</p>
                <p className="text-slate-600 text-xs">You&apos;re all caught up</p>
              </div>
            ) : (
              myNotifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] transition-colors hover:bg-white/[0.04] last:border-0',
                    !n.read && 'bg-[#67e8f9]/[0.03]'
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    'shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5',
                    !n.read ? 'bg-white/[0.08]' : 'bg-white/[0.04]'
                  )}>
                    {notificationIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-xs leading-snug truncate',
                      n.read ? 'text-slate-400' : 'text-slate-100 font-medium'
                    )}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#67e8f9] mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </header>
  );
}
