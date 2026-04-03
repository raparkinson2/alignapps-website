'use client';

import { useState } from 'react';

interface Faq {
  q: string;
  a: string;
}

export default function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {faqs.map((faq, i) => (
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
  );
}
