'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const SPORTS = [
  { emoji: '🏒', name: 'Hockey' },
  { emoji: '⚾', name: 'Baseball' },
  { emoji: '🏀', name: 'Basketball' },
  { emoji: '⚽', name: 'Soccer' },
  { emoji: '🥍', name: "Men's Lacrosse" },
  { emoji: '🥍', name: "Women's Lacrosse" },
  { emoji: '🥎', name: 'Softball' },
];

const FEATURES = [
  {
    icon: '📅',
    title: 'Smart Scheduling',
    desc: 'Create games, practices, and events in seconds. Track RSVPs, set jersey colors, and send instant notifications — all from one place.',
    large: true,
    color: 'cyan',
    bullets: ['List & calendar views', 'Game check-in / check-out', 'Final scores & stats', 'Schedule invite links'],
  },
  {
    icon: '👥',
    title: 'Roster Management',
    desc: 'Organize your roster with roles, positions, jersey numbers, and status badges. Invite players by text or email.',
    color: 'purple',
  },
  {
    icon: '💳',
    title: 'Payment Tracking',
    desc: 'Assign and track payments directly in the app. Log Venmo, PayPal, Zelle, and Cash App — no spreadsheet required.',
    color: 'green',
  },
  {
    icon: '💬',
    title: 'Team Chat',
    desc: 'Real-time group messaging with @mentions, GIF support, and image sharing. Keep everything in one place.',
    color: 'cyan',
  },
  {
    icon: '📊',
    title: 'Stats & Records',
    desc: 'Track individual and team stats by sport. Season history, win percentages, and career records — always up to date.',
    color: 'purple',
  },
  {
    icon: '🏆',
    title: 'Sport-Specific Lineups',
    desc: 'Build lineups made for your sport — hockey lines, baseball batting orders, soccer formations, and more.',
    large: true,
    color: 'green',
    bullets: [
      'Hockey: Lines, goalie tracking, +/−',
      'Baseball/Softball: 9 & 10-player orders',
      'Soccer: 4-4-2 & diamond formations',
      'Basketball: Starting 5 + bench',
    ],
  },
  {
    icon: '📸',
    title: 'Team Photos',
    desc: 'A shared photo gallery for your whole team. Capture in-app or upload from your camera roll — instantly synced.',
    color: 'cyan',
  },
  {
    icon: '🔔',
    title: 'Push Notifications',
    desc: 'Game reminders, new lineups, chat messages, and payment updates — delivered the moment they happen.',
    color: 'purple',
  },
  {
    icon: '🔄',
    title: 'Multiple Teams',
    desc: 'Play on more than one team? No problem. Switch between teams instantly, each with its own roster and schedule.',
    color: 'green',
  },
];

const FAQS = [
  {
    q: 'What sports does the app support?',
    a: "Hockey, Baseball, Softball, Basketball, Soccer, Men's Lacrosse, and Women's Lacrosse — with more on the way.",
  },
  {
    q: 'Can I manage multiple teams?',
    a: 'Yes. You can be a member of multiple teams and switch between them instantly from the app.',
  },
  {
    q: 'Do all players need to download the app?',
    a: 'Yes, but setup takes under a minute. Players get an invite and join with their email or phone number — no complicated onboarding.',
  },
  {
    q: 'How does payment tracking work?',
    a: 'Admins create payment periods and manually log when players pay (Venmo, PayPal, Zelle, Cash App). Full Stripe payment processing is coming soon.',
  },
  {
    q: "Is my team's data private?",
    a: "Yes. Your team's data is private and never shared with third parties. Only your team members can access it.",
  },
  {
    q: 'Is ALIGN Sports available on Android?',
    a: 'Currently available on iOS. Android support is coming Spring 2026.',
  },
  {
    q: 'What is your cancellation policy?',
    a: 'You can cancel anytime via the app Settings or by emailing rob@alignapps.com. Fees paid are non-refundable except in exceptional cases reviewed on a case-by-case basis.',
  },
];

const WHO = [
  { icon: '🧢', label: 'Coaches' },
  { icon: '⭐', label: 'Team Captains' },
  { icon: '🏟️', label: 'Recreational Leagues' },
  { icon: '👨‍👩‍👧', label: 'Youth Organizers' },
  { icon: '📱', label: 'Anyone tired of group texts' },
];

const STEPS = [
  {
    num: '01',
    title: 'Create your team',
    desc: 'Download the app, pick your sport, and set up your team in under two minutes.',
  },
  {
    num: '02',
    title: 'Invite your players',
    desc: 'Send invite links by text or email. Players join instantly — no complicated sign-up.',
  },
  {
    num: '03',
    title: 'Run your season',
    desc: 'Schedule games, track payments, manage lineups, and keep your whole team connected.',
  },
];

type ColorKey = 'cyan' | 'purple' | 'green';

function colorClass(color: ColorKey) {
  if (color === 'cyan')   return { bg: 'bg-[#67e8f9]/10', text: 'text-[#67e8f9]', dot: '#67e8f9', border: 'border-[#67e8f9]/20' };
  if (color === 'purple') return { bg: 'bg-[#a78bfa]/10', text: 'text-[#a78bfa]', dot: '#a78bfa', border: 'border-[#a78bfa]/20' };
  return                         { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]', dot: '#22c55e', border: 'border-[#22c55e]/20' };
}

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-16"
        style={{ background: 'rgba(8,12,20,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏆</span>
          <span className="font-bold text-lg tracking-tight">ALIGN Sports</span>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-7">
          {[
            { label: 'Features',     href: '#features' },
            { label: 'Sports',       href: '#sports' },
            { label: 'How It Works', href: '#how-it-works' },
            { label: 'FAQ',          href: '#faq' },
          ].map((item) => (
            <a key={item.label} href={item.href} className="text-sm text-slate-400 hover:text-slate-100 transition-colors">
              {item.label}
            </a>
          ))}
        </div>

        {/* Sign In CTA */}
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-[#080c14] bg-[#67e8f9] hover:bg-[#67e8f9]/90 transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(103,232,249,0.07) 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(167,139,250,0.05) 0%, transparent 70%)' }} />

        <div className="relative max-w-3xl mx-auto">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#67e8f9]/25 mb-7"
            style={{ background: 'rgba(103,232,249,0.07)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#67e8f9] animate-pulse" />
            <span className="text-xs font-semibold tracking-widest uppercase text-[#67e8f9]">Team management without the chaos</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6">
            Your team,{' '}
            <span style={{ background: 'linear-gradient(135deg, #67e8f9 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              finally organized.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            ALIGN Sports is a simple, powerful team management app built for coaches, captains, and organizers who are tired of chasing people down. If your team lives in group texts and "who's coming tonight?" messages — this fixes that.
          </p>

          {/* Store buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-14">
            <a
              href="https://apps.apple.com"
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-[#080c14] bg-[#67e8f9] hover:bg-[#67e8f9]/90 transition-all shadow-lg"
              style={{ boxShadow: '0 8px 32px rgba(103,232,249,0.18)' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              App Store
            </a>
            <div className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-slate-500 border border-white/[0.06] cursor-default select-none">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" opacity="0.5"><path d="M3.18 23.76c.28.16.6.24.93.22l13.5-7.76-2.9-2.9-11.53 10.44zM.5 1.82C.18 2.16 0 2.7 0 3.4v17.2c0 .7.18 1.24.5 1.58l.08.08 9.64-9.64v-.23L.58 1.74l-.08.08zM20.11 10.3l-2.74-1.58-3.06 3.06 3.06 3.07 2.77-1.6c.79-.45.79-1.19-.03-1.95zM4.1.22L17.6 7.98l-2.9 2.9L3.18.48C3.5.24 3.84.08 4.1.22z"/></svg>
              Google Play — Soon
            </div>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex -space-x-1.5">
              {['🏒', '⚽', '🏀', '⚾', '🥎', '🥍'].map((e, i) => (
                <div key={i} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-sm" style={{ background: '#0f1a2e' }}>
                  {e}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-400">Used by teams across <span className="text-slate-200 font-semibold">7 sports</span></p>
          </div>
        </div>
      </section>

      {/* ── SPORTS STRIP ────────────────────────────────────────────────── */}
      <section id="sports" className="py-10 border-y" style={{ background: '#0d1526', borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-center text-xs font-semibold tracking-widest uppercase text-slate-500 mb-6">Built for every sport</p>
        <div className="flex flex-wrap items-center justify-center gap-3 px-6">
          {SPORTS.map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-slate-300 border border-white/[0.08] hover:border-[#67e8f9]/30 transition-colors"
              style={{ background: 'rgba(255,255,255,0.025)' }}
            >
              <span>{s.emoji}</span>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#67e8f9] mb-3">Everything your team needs</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">All in one app.</h2>
          <p className="text-slate-400 mt-4 max-w-xl mx-auto">
            No more juggling group texts, spreadsheets, and Venmo requests. ALIGN brings it all together.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => {
            const c = colorClass(f.color as ColorKey);
            return (
              <div
                key={i}
                className={`p-6 rounded-2xl border border-white/[0.07] hover:border-white/[0.13] transition-all ${f.large ? 'lg:col-span-2' : ''}`}
                style={{ background: '#0f1a2e' }}
              >
                <div className={`inline-flex w-11 h-11 rounded-xl items-center justify-center text-xl mb-4 border ${c.bg} ${c.border}`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-lg text-slate-100 mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                {f.bullets && (
                  <ul className="mt-4 space-y-1.5">
                    {f.bullets.map((b, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── WHO IT'S FOR ────────────────────────────────────────────────── */}
      <section className="py-20 border-y" style={{ background: '#0d1526', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#a78bfa] mb-3">Who it's for</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Built for the people running the team</h2>
          <p className="text-slate-400 mb-12">Anyone who's tired of chasing people down — this is your app.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {WHO.map((w) => (
              <div
                key={w.label}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/[0.07] hover:border-[#a78bfa]/30 transition-colors"
                style={{ background: 'rgba(255,255,255,0.025)' }}
              >
                <span className="text-lg">{w.icon}</span>
                <span className="text-sm font-medium text-slate-200">{w.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#22c55e] mb-3">Simple setup</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Up and running in minutes</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {STEPS.map((s, i) => (
            <div key={i} className="relative flex flex-col items-center text-center p-8">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-14 right-0 w-px h-16" style={{ background: 'rgba(255,255,255,0.07)' }} />
              )}
              <div className="text-5xl font-black mb-4" style={{ color: 'rgba(103,232,249,0.22)' }}>{s.num}</div>
              <h3 className="font-bold text-lg text-slate-100 mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 border-t" style={{ background: '#0d1526', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#67e8f9] mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Common questions</h2>
          </div>

          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/[0.07] overflow-hidden"
                style={{ background: '#0f1a2e' }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-medium text-slate-100 text-sm pr-4">{faq.q}</span>
                  <span
                    className="text-slate-500 flex-shrink-0 transition-transform duration-200"
                    style={{ transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}
                  >
                    ▾
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-slate-400 leading-relaxed border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DOWNLOAD CTA ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(103,232,249,0.07) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Ready to{' '}
            <span style={{ background: 'linear-gradient(135deg, #67e8f9 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ALIGN
            </span>
            {' '}your team?
          </h2>
          <p className="text-slate-400 mb-10 text-lg">Because teams perform better when everyone is on the same page.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
            <a
              href="https://apps.apple.com"
              className="flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-[#080c14] bg-[#67e8f9] hover:bg-[#67e8f9]/90 transition-all text-base"
              style={{ boxShadow: '0 8px 40px rgba(103,232,249,0.22)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Download on App Store
            </a>
            <div className="flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-slate-600 border border-white/[0.05] text-base cursor-default select-none">
              Google Play — Spring 2026
            </div>
          </div>

          <p className="text-xs text-slate-600 uppercase tracking-widest">iOS Available Now</p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t py-12 px-6" style={{ background: '#0d1526', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🏆</span>
                <span className="font-bold text-lg">ALIGN Sports</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                Team management for recreational sports. Built for players, by players.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">App</p>
              <ul className="space-y-2">
                {['Features', 'Supported Sports', 'Download iOS'].map((l) => (
                  <li key={l}>
                    <a href="#features" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Legal</p>
              <ul className="space-y-2">
                <li><a href="/privacy" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Terms of Service</a></li>
                <li><a href="mailto:rob@alignapps.com" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-xs text-slate-500">© 2025 Align Sports. All rights reserved.</p>
            <p className="text-xs text-slate-600">
              <a href="mailto:rob@alignapps.com" className="hover:text-slate-400 transition-colors">rob@alignapps.com</a>
              {' · '}
              <a href="https://www.alignapps.com" className="hover:text-slate-400 transition-colors">www.alignapps.com</a>
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
