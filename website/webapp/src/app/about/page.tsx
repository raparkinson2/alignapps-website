'use client';

import Link from 'next/link';

const DIFFERENTIATORS = [
  {
    icon: '📱',
    title: 'Mobile App + Web Platform',
    desc: 'Most team apps are stuck on one platform. ALIGN Sports works seamlessly as a native iOS app and a full web dashboard — so your team can manage everything from their phone on the sideline or from a laptop at home.',
    color: 'cyan',
  },
  {
    icon: '🏆',
    title: 'Built for Recreational Athletes',
    desc: 'We designed ALIGN Sports specifically for recreational and amateur sports — not elite clubs or pro franchises. The tools are powerful but never overcomplicated, because your team just wants to play.',
    color: 'purple',
  },
  {
    icon: '⚡',
    title: 'Everything in One Place',
    desc: 'No more bouncing between group texts, spreadsheets, Venmo, and random websites. Scheduling, rosters, payments, chat, stats, lineups, and photos — all in a single app your whole team will actually use.',
    color: 'green',
  },
  {
    icon: '🎯',
    title: 'Sport-Specific Features',
    desc: 'Generic sports apps treat every sport the same. ALIGN Sports has sport-specific lineup builders for hockey, baseball, softball, basketball, soccer, and lacrosse — built by people who know how each game actually works.',
    color: 'cyan',
  },
];

type ColorKey = 'cyan' | 'purple' | 'green';

function colorClass(color: ColorKey) {
  if (color === 'cyan')   return { bg: 'bg-[#67e8f9]/10', text: 'text-[#67e8f9]', dot: '#67e8f9', border: 'border-[#67e8f9]/20', accent: '#67e8f9' };
  if (color === 'purple') return { bg: 'bg-[#a78bfa]/10', text: 'text-[#a78bfa]', dot: '#a78bfa', border: 'border-[#a78bfa]/20', accent: '#a78bfa' };
  return                         { bg: 'bg-[#22c55e]/10', text: 'text-[#22c55e]', dot: '#22c55e', border: 'border-[#22c55e]/20', accent: '#22c55e' };
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-16"
        style={{ background: 'rgba(8,12,20,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <span className="text-xl">🏆</span>
          <span className="font-bold text-lg tracking-tight">ALIGN Sports</span>
        </Link>

        <div className="hidden md:flex items-center gap-7">
          {[
            { label: 'Features',  href: '/#features' },
            { label: 'Sports',    href: '/#sports' },
            { label: 'FAQ',       href: '/#faq' },
            { label: 'About',     href: '/about' },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="text-sm text-slate-400 hover:text-slate-100 transition-colors">
              {item.label}
            </Link>
          ))}
        </div>

        <Link
          href="/login"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-[#080c14] bg-[#67e8f9] hover:bg-[#67e8f9]/90 transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-40 pb-24 px-6 text-center overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(103,232,249,0.07) 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(167,139,250,0.05) 0%, transparent 70%)' }} />

        <div className="relative max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#67e8f9]/25 mb-7"
            style={{ background: 'rgba(103,232,249,0.07)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#67e8f9]" />
            <span className="text-xs font-semibold tracking-widest uppercase text-[#67e8f9]">Our Story</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6">
            Built by athletes,{' '}
            <span style={{ background: 'linear-gradient(135deg, #67e8f9 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              for athletes.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            ALIGN Sports started with a simple frustration: running a recreational sports team should not require a spreadsheet, three group chats, and a prayer that everyone shows up.
          </p>
        </div>
      </section>

      {/* ── ORIGIN STORY ─────────────────────────────────────────────────── */}
      <section className="py-20 border-y" style={{ background: '#0d1526', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="space-y-6 text-slate-300 leading-relaxed text-lg">
            <p>
              We are <span className="text-slate-100 font-semibold">ALIGN Apps, LLC</span> — a small team of athletes and builders who got tired of the same problem season after season. Too many tools, too much friction, and teammates who never knew when the game was.
            </p>
            <p>
              So we built something better. ALIGN Sports is the team management app we always wished existed — one that handles scheduling, rosters, payments, chat, stats, and lineups all in one place, without requiring a degree in software to operate.
            </p>
            <p>
              We play the sports we build for. That is not a marketing line — it is why the hockey lineup editor actually makes sense, why the payment tracker works the way captains think, and why the app does not feel like it was designed by someone who has never set foot on a rink or a diamond.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT SETS US APART ───────────────────────────────────────────── */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#a78bfa] mb-3">Why ALIGN Sports</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">What sets us apart</h2>
          <p className="text-slate-400 mt-4 max-w-xl mx-auto">
            There are other team apps out there. Here is why athletes and organizers choose ALIGN.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {DIFFERENTIATORS.map((item, i) => {
            const c = colorClass(item.color as ColorKey);
            return (
              <div
                key={i}
                className="p-7 rounded-2xl border border-white/[0.07] hover:border-white/[0.13] transition-all flex flex-col gap-4"
                style={{ background: '#0f1a2e' }}
              >
                <div className={`inline-flex w-12 h-12 rounded-xl items-center justify-center text-2xl border ${c.bg} ${c.border}`}>
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-100 mb-2">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── MOBILE + WEB CALLOUT ─────────────────────────────────────────── */}
      <section className="py-20 border-y" style={{ background: '#0d1526', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#22c55e] mb-3">Two platforms, one experience</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
            Native mobile app.<br />Full web dashboard.
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
            Manage your team from the mobile app or the website. Manage rosters, lineups, stats, schedules, and payments. Same data. Always in sync. No compromise. No chaos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              { label: 'iOS App', badge: 'Coming Soon', color: '#67e8f9' },
              { label: 'Web Dashboard', badge: 'Access from any browser', color: '#a78bfa' },
              { label: 'Real-Time Sync', badge: 'Always up to date', color: '#22c55e' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center px-7 py-5 rounded-2xl border border-white/[0.07]"
                style={{ background: 'rgba(255,255,255,0.025)' }}
              >
                <span className="font-bold text-slate-100 text-base mb-1">{item.label}</span>
                <span className="text-xs font-medium" style={{ color: item.color }}>{item.badge}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#67e8f9] mb-3">What we believe</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight">Our values</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              title: 'Simplicity first',
              desc: 'Powerful features should not mean complicated interfaces. If it takes more than two taps, we rethink it.',
              color: '#67e8f9',
            },
            {
              title: 'Athletes know best',
              desc: 'Every feature we ship is built around how real players and coaches actually think — not how product managers think they do.',
              color: '#a78bfa',
            },
            {
              title: 'Accessible to everyone',
              desc: 'Recreational sports belong to everyone. ALIGN Sports is priced fairly and built to work for every level, from youth leagues to adult rec.',
              color: '#22c55e',
            },
          ].map((v, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border border-white/[0.07] flex flex-col gap-3"
              style={{ background: '#0f1a2e' }}
            >
              <div className="w-1.5 h-8 rounded-full" style={{ background: v.color }} />
              <h3 className="font-bold text-lg text-slate-100">{v.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(103,232,249,0.06) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Come play with{' '}
            <span style={{ background: 'linear-gradient(135deg, #67e8f9 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ALIGN.
            </span>
          </h2>
          <p className="text-slate-400 mb-10 text-lg">Sign in to the web platform and get your team organized in minutes. The mobile app is coming soon.</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <div
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-slate-300 border border-white/[0.10] cursor-default select-none text-sm"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              iOS App — Coming Soon
            </div>
            <Link
              href="/login"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-slate-200 border border-white/[0.12] hover:border-[#67e8f9]/40 hover:text-slate-100 transition-all text-sm"
            >
              Open Web App
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
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
              <p className="text-slate-600 text-xs mt-3">A product of ALIGN Apps, LLC</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">App</p>
              <ul className="space-y-2">
                <li><Link href="/#features" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Features</Link></li>
                <li><Link href="/#sports" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Supported Sports</Link></li>
                <li><Link href="/about" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">About Us</Link></li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Legal</p>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Terms of Service</Link></li>
                <li><a href="mailto:rob@alignapps.com" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-xs text-slate-500">© 2025 ALIGN Apps, LLC. All rights reserved.</p>
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
