import Link from 'next/link';

export default function NoAccountPage() {
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0f1a2e] border border-white/10 rounded-2xl p-8 text-center">

        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-5">
          <span className="text-3xl">📱</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-100 mb-2">No Account Found</h1>
        <p className="text-slate-400 mb-6 leading-relaxed">
          Your Apple ID isn't linked to an ALIGN Sports account yet. Accounts are created through the mobile app, which is launching soon.
        </p>

        <div className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-slate-300 bg-white/[0.05] border border-white/10 mb-3">
          <span className="text-base">📱</span>
          iOS &amp; Android — Coming Soon
        </div>

        <Link
          href="/login"
          className="block text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
