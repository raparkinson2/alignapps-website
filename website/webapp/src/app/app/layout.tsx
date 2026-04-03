'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTeamStore } from '@/lib/store';
import { useTeamData } from '@/hooks/useTeamData';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, isLoggedIn, pendingTeamOptions, selectTeam } = useAuth();
  useTeamData();

  useEffect(() => {
    useTeamStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!loading && !isLoggedIn && pendingTeamOptions.length === 0) {
      router.push('/login');
    }
  }, [loading, isLoggedIn, pendingTeamOptions.length, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#67e8f9]/20 border-t-[#67e8f9] animate-spin" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Multi-team selector — shown after OAuth when the user belongs to multiple teams
  if (pendingTeamOptions.length > 0) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0f1a2e] border border-white/10 rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 mb-4">
              <span className="text-2xl">🏆</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100">Select Team</h1>
            <p className="text-slate-400 mt-1 text-sm">You belong to multiple teams. Which would you like to open?</p>
          </div>
          <div className="space-y-2">
            {pendingTeamOptions.map((option) => (
              <button
                key={option.teamId}
                onClick={() => selectTeam(option)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] hover:border-[#67e8f9]/30 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#67e8f9]/10 flex items-center justify-center text-lg shrink-0">
                  🏆
                </div>
                <div>
                  <p className="font-medium text-slate-100">{option.teamName}</p>
                  <p className="text-xs text-slate-400">{option.playerName}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#080c14]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
