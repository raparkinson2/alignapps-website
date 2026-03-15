'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, ImageIcon, Smile, X, Search, AtSign } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { pushChatMessageToSupabase, deleteChatMessageFromSupabase, uploadAndSavePhoto } from '@/lib/realtime-sync';
import { generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import MessageBubble from '@/components/chat/MessageBubble';
import type { ChatMessage } from '@/lib/types';

const GIPHY_API_KEY = 'mUSMkXeohjZdAa2fSpTRGq7ljx5h00fI';
const GIPHY_LIMIT = 20;

interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  title: string;
}

async function fetchGifs(query: string): Promise<GifResult[]> {
  try {
    const endpoint = query.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${GIPHY_LIMIT}&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${GIPHY_LIMIT}&rating=pg-13`;
    const res = await fetch(endpoint);
    if (!res.ok) return [];
    const data = await res.json() as { data: Array<{ id: string; title: string; images: { fixed_width: { url: string; width: string; height: string }; fixed_width_small: { url: string } } }> };
    return data.data.map((g) => ({
      id: g.id,
      url: g.images.fixed_width.url,
      previewUrl: g.images.fixed_width_small.url,
      width: parseInt(g.images.fixed_width.width, 10) || 200,
      height: parseInt(g.images.fixed_width.height, 10) || 200,
      title: g.title,
    }));
  } catch {
    return [];
  }
}

function GifPicker({ onSelect, onClose }: { onSelect: (gif: GifResult) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchGifs('').then((results) => { setGifs(results); setLoading(false); });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await fetchGifs(query);
      setGifs(results);
      setLoading(false);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div className="absolute bottom-full mb-2 left-0 w-80 bg-[#0d1526] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.07]">
        <Search size={14} className="text-slate-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
          autoFocus
        />
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Grid */}
      <div className="h-60 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 rounded-full border-2 border-[#67e8f9]/30 border-t-[#67e8f9] animate-spin" />
          </div>
        ) : gifs.length === 0 ? (
          <p className="text-center text-xs text-slate-500 mt-8">No GIFs found</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect(gif)}
                className="rounded-xl overflow-hidden hover:opacity-80 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gif.previewUrl} alt={gif.title} className="w-full h-24 object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Powered by GIPHY */}
      <div className="px-3 py-1.5 border-t border-white/[0.07] text-center">
        <span className="text-[10px] text-slate-600">Powered by GIPHY</span>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const chatMessages = useTeamStore((s) => s.chatMessages);
  const players = useTeamStore((s) => s.players);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const addChatMessage = useTeamStore((s) => s.addChatMessage);
  const deleteChatMessage = useTeamStore((s) => s.deleteChatMessage);
  const markChatAsRead = useTeamStore((s) => s.markChatAsRead);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [showMentionPicker, setShowMentionPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gifPickerRef = useRef<HTMLDivElement>(null);

  const currentPlayer = players.find((p) => p.id === currentPlayerId) ?? null;

  // Filtered mention suggestions
  type MentionSuggestion = { id: string; firstName: string; lastName: string; name?: string };
  const mentionSuggestions = useMemo((): MentionSuggestion[] => {
    const q = mentionQuery.toLowerCase();
    const everyone: MentionSuggestion = { id: 'everyone', firstName: 'everyone', lastName: '', name: '@everyone' };
    const playerList: MentionSuggestion[] = players
      .filter((p) => p.id !== currentPlayerId && p.status === 'active')
      .filter((p) => {
        if (!q) return true;
        const name = `${p.firstName} ${p.lastName}`.toLowerCase();
        return name.includes(q);
      })
      .slice(0, 8);
    if (!q || 'everyone'.includes(q)) return [everyone, ...playerList];
    return playerList;
  }, [players, currentPlayerId, mentionQuery]);

  // Mark as read on mount and when new messages arrive
  useEffect(() => {
    if (currentPlayerId) {
      markChatAsRead(currentPlayerId);
    }
  }, [currentPlayerId, chatMessages.length, markChatAsRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Close gif picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Detect @ mention
    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStartIndex(cursor - atMatch[0].length);
      setShowMentionPicker(true);
    } else {
      setShowMentionPicker(false);
      setMentionStartIndex(null);
    }
  };

  const handleSelectMention = (player: { id: string; firstName: string; lastName: string; name?: string }) => {
    if (mentionStartIndex === null) return;
    const displayName = player.name ?? `${player.firstName} ${player.lastName}`;
    const before = text.slice(0, mentionStartIndex);
    const after = text.slice(mentionStartIndex + 1 + mentionQuery.length);
    const newText = `${before}@${displayName} ${after}`;
    setText(newText);
    setShowMentionPicker(false);
    setMentionStartIndex(null);
    setMentionQuery('');
    textareaRef.current?.focus();
  };

  const handleSend = useCallback(async (imageUrl?: string, gifData?: { url: string; width: number; height: number }) => {
    const msgText = text.trim();
    if (!msgText && !imageUrl && !gifData) return;
    if (!currentPlayerId || !activeTeamId) return;

    setSending(true);

    // Extract mentions
    const mentionedIds: string[] = [];
    let mentionType: 'all' | 'specific' | undefined;
    const mentionMatches = Array.from(msgText.matchAll(/@([\w ]+?)(?=\s|$)/g));
    for (const m of mentionMatches) {
      const name = m[1].trim().toLowerCase();
      if (name === 'everyone') {
        mentionType = 'all';
        break;
      }
      const found = players.find((p) => `${p.firstName} ${p.lastName}`.toLowerCase() === name);
      if (found) mentionedIds.push(found.id);
    }
    if (mentionedIds.length > 0 && !mentionType) mentionType = 'specific';

    const msg: ChatMessage = {
      id: generateId(),
      senderId: currentPlayerId,
      senderName: currentPlayer
        ? `${currentPlayer.firstName} ${currentPlayer.lastName}`
        : undefined,
      message: msgText,
      imageUrl,
      gifUrl: gifData?.url,
      gifWidth: gifData?.width,
      gifHeight: gifData?.height,
      createdAt: new Date().toISOString(),
      mentionedPlayerIds: mentionedIds,
      mentionType,
    };

    addChatMessage(msg);
    setText('');
    await pushChatMessageToSupabase(msg, activeTeamId);
    setSending(false);
  }, [text, currentPlayerId, activeTeamId, currentPlayer, addChatMessage, players]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionPicker && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab')) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape' && showMentionPicker) {
      setShowMentionPicker(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !showMentionPicker) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async (id: string) => {
    deleteChatMessage(id);
    await deleteChatMessageFromSupabase(id);
  };

  const handleImageAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTeamId || !currentPlayerId) return;
    setUploading(true);
    const uri = await uploadAndSavePhoto(file, activeTeamId, currentPlayerId);
    setUploading(false);
    if (uri) {
      await handleSend(uri);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGifSelect = async (gif: GifResult) => {
    setShowGifPicker(false);
    await handleSend(undefined, { url: gif.url, width: gif.width, height: gif.height });
  };

  return (
    <div className="flex flex-col h-full -m-4 -mb-20 lg:-m-6 lg:-mb-6">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 space-y-2">
        {chatMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-slate-400 text-sm">No messages yet</p>
              <p className="text-slate-500 text-xs mt-1">Be the first to say something!</p>
            </div>
          </div>
        )}

        {chatMessages.map((msg) => {
          const sender = players.find((p) => p.id === msg.senderId) ?? null;
          const isOwn = msg.senderId === currentPlayerId;
          return (
            <div key={msg.id} className="relative">
              <MessageBubble
                message={msg}
                isOwn={isOwn}
                sender={sender}
                players={players}
                onDelete={isOwn ? handleDelete : undefined}
              />
            </div>
          );
        })}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input bar */}
      <div className="shrink-0 bg-[#0d1526] border-t border-white/[0.07] px-4 py-3 lg:px-6">
        {/* Mention picker */}
        {showMentionPicker && mentionSuggestions.length > 0 && (
          <div className="mb-2 bg-[#0d1526] border border-white/10 rounded-xl overflow-hidden shadow-xl">
            {mentionSuggestions.map((p) => (
              <button
                key={p.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelectMention(p); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.05] transition-colors text-left"
              >
                <span className="text-[#67e8f9]">
                  <AtSign size={13} />
                </span>
                <span className="text-sm text-slate-200">
                  {p.name ?? `${p.firstName} ${p.lastName}`}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Image attach */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
            className="p-2.5 rounded-xl text-slate-400 hover:text-[#67e8f9] hover:bg-[#67e8f9]/10 transition-all disabled:opacity-50 shrink-0"
            aria-label="Attach image"
          >
            <ImageIcon size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageAttach}
          />

          {/* GIF button */}
          <div ref={gifPickerRef} className="relative shrink-0">
            <button
              onClick={() => setShowGifPicker((v) => !v)}
              disabled={sending || uploading}
              className={cn(
                'p-2.5 rounded-xl transition-all disabled:opacity-50',
                showGifPicker
                  ? 'text-[#67e8f9] bg-[#67e8f9]/10'
                  : 'text-slate-400 hover:text-[#67e8f9] hover:bg-[#67e8f9]/10'
              )}
              aria-label="Send GIF"
            >
              <Smile size={18} />
            </button>
            {showGifPicker && (
              <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
            )}
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder="Message the team... (@ to mention)"
              rows={1}
              disabled={sending || uploading}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/30 focus:border-[#67e8f9]/30 resize-none text-sm leading-relaxed max-h-32 overflow-y-auto disabled:opacity-50"
              style={{ minHeight: '42px' }}
            />
          </div>

          {/* Send button */}
          <button
            onClick={() => handleSend()}
            disabled={(!text.trim() && !uploading) || sending}
            className="p-2.5 rounded-xl bg-[#67e8f9] text-[#080c14] hover:bg-[#67e8f9]/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            aria-label="Send message"
          >
            {sending || uploading ? (
              <div className="w-4 h-4 rounded-full border-2 border-[#080c14]/30 border-t-[#080c14] animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
