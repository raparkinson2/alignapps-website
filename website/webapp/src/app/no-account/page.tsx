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
          Your Apple ID isn't linked to an ALIGN Sports account yet. Accounts are created through the mobile app — download it to get started with your team.
        </p>

        <a
          href="https://apps.apple.com/us/app/align-sports/id6743450598"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-[#080c14] bg-[#67e8f9] hover:bg-[#67e8f9]/90 transition-colors mb-3"
        >
          <svg width="18" height="18" viewBox="0 0 814 1000" fill="currentColor">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.8 135.4-317.9 269-317.9 70.5 0 129.2 46.4 173.8 46.4 42.7 0 109.4-49 188.4-49 30.6 0 108.2 2.6 168.5 80.1zm-198.6-77.5c31.6-36.2 53.9-86.5 53.9-136.8 0-7.1-.6-14.3-1.9-20.1-51.3 1.9-112.3 34.2-149.2 75.8-28.5 32.4-55.1 83.1-55.1 134.1 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 46.4 0 102.7-30.9 136.8-72.4z"/>
          </svg>
          Download on the App Store
        </a>

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
