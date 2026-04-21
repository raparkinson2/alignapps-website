'use client';

import React, { useState, useEffect } from 'react';
import { Link2, Copy, Check, Shield, ShieldCheck, RefreshCw, Share2 } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import Modal from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

function adminHeaders(): Record<string, string> {
  const secret = process.env.NEXT_PUBLIC_INTERNAL_API_SECRET;
  if (!secret) return {};
  return { 'x-admin-secret': secret };
}

interface InviteLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExpiresIn = '24h' | '7d' | '30d' | 'never';

export default function InviteLinkModal({ isOpen, onClose }: InviteLinkModalProps) {
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [expiresIn, setExpiresIn] = useState<ExpiresIn>('never');

  const generateLink = async () => {
    if (!activeTeamId) return;
    setLoading(true);
    setCopied(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/invite/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({
          teamId: activeTeamId,
          createdBy: currentPlayerId,
          expiresIn,
          requireApproval,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to create invite link');
        return;
      }
      setInviteUrl(data.url);
    } catch {
      alert('Could not generate invite link. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !inviteUrl) {
      generateLink();
    }
  }, [isOpen]);

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleRegenerate = () => {
    setInviteUrl('');
    generateLink();
  };

  const handleClose = () => {
    setInviteUrl('');
    setCopied(false);
    onClose();
  };

  const expiryOptions: { value: ExpiresIn; label: string }[] = [
    { value: 'never', label: 'Never' },
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite to Team" size="md">
      <div className="space-y-5">
        {/* Approval Setting */}
        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Join Settings
          </p>
          <button
            onClick={() => {
              setRequireApproval(!requireApproval);
              if (inviteUrl) {
                setInviteUrl('');
                setTimeout(() => generateLink(), 100);
              }
            }}
            className="w-full flex items-center gap-3 bg-[#0f1a2e] border border-white/10 rounded-xl p-3 hover:bg-[#152236] transition-all text-left"
          >
            <div className={cn('p-2 rounded-full', requireApproval ? 'bg-amber-500/20' : 'bg-green-500/20')}>
              {requireApproval
                ? <Shield size={18} className="text-amber-400" />
                : <ShieldCheck size={18} className="text-green-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">
                {requireApproval ? 'Approval Required' : 'Auto-Approve'}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">
                {requireApproval
                  ? 'New players need admin approval to join'
                  : 'Anyone with the link joins immediately'
                }
              </p>
            </div>
            <div className={cn(
              'w-10 h-6 rounded-full flex items-center transition-colors',
              requireApproval ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
            )}>
              <div className="w-4 h-4 rounded-full bg-white mx-1" />
            </div>
          </button>
        </div>

        {/* Expiration */}
        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Link Expires
          </p>
          <div className="flex gap-2">
            {expiryOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setExpiresIn(opt.value);
                  if (inviteUrl) {
                    setInviteUrl('');
                    setTimeout(() => generateLink(), 100);
                  }
                }}
                className={cn(
                  'flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                  expiresIn === opt.value
                    ? 'bg-[#67e8f9]/20 border-[#67e8f9]/40 text-[#67e8f9]'
                    : 'bg-[#0f1a2e] border-white/10 text-slate-400 hover:text-slate-200'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Link Display */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <svg className="animate-spin mr-2 h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating invite link...
          </div>
        ) : inviteUrl ? (
          <div className="space-y-3">
            {/* URL Display */}
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-2 bg-[#0f1a2e] border border-white/10 rounded-xl p-3 hover:bg-[#152236] transition-all text-left"
            >
              <Link2 size={16} className="text-[#67e8f9] shrink-0" />
              <span className="text-slate-300 text-sm flex-1 truncate">{inviteUrl}</span>
              {copied
                ? <Check size={16} className="text-green-400 shrink-0" />
                : <Copy size={16} className="text-slate-500 shrink-0" />
              }
            </button>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 bg-[#67e8f9] text-slate-900 font-bold py-2.5 rounded-xl hover:bg-[#5bd4e3] transition-all text-sm"
              >
                <Copy size={16} />
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={handleRegenerate}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all text-sm"
              >
                <RefreshCw size={14} />
                New Link
              </button>
            </div>
          </div>
        ) : null}

        {/* Instructions */}
        <div className="bg-[#0f1a2e]/60 rounded-xl p-3 border border-white/5">
          <p className="text-slate-400 text-xs leading-relaxed">
            Share this link with players. They&apos;ll fill in their info and
            {requireApproval
              ? ' appear as pending until you approve them.'
              : ' be added to the roster automatically.'
            }
          </p>
        </div>
      </div>
    </Modal>
  );
}
