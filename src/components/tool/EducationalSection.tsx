import React, { useState } from 'react';
import { ChevronDown, HelpCircle, BookOpen } from 'lucide-react';
import { EducationalSectionData } from '../../types';

export interface EducationalSectionProps {
  data: EducationalSectionData;
  className?: string;
}

export const EducationalSection: React.FC<EducationalSectionProps> = ({ data, className = '' }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <section className={`mt-16 pt-12 border-t border-slate-800/80 ${className}`}>
      <div className="flex items-center gap-2 mb-2 text-emerald-400 font-mono text-xs font-semibold uppercase tracking-wider">
        <BookOpen className="w-4 h-4" aria-hidden="true" />
        <span>Documentation & Technical Guide</span>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{data.title}</h2>
      {data.subtitle && <p className="text-sm text-slate-400 mb-8 max-w-3xl">{data.subtitle}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {data.content.map((item) => (
          <div
            key={item.heading}
            className="p-5 rounded-xl border border-slate-800/90 bg-slate-900/40 hover:border-slate-700/80 transition-colors"
          >
            <h3 className="text-base font-semibold text-slate-100 mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {item.heading}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans mb-3 whitespace-pre-line">{item.body}</p>
            {item.codeExample && (
              <pre className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre">
                {item.codeExample}
              </pre>
            )}
          </div>
        ))}
      </div>

      {data.faqs && data.faqs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4 tracking-tight flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <span>Frequently Asked Questions</span>
          </h2>

          <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-slate-900/30 overflow-hidden">
            {data.faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              const answerId = `faq-answer-${index}`;
              const buttonId = `faq-question-${index}`;

              return (
                <div key={faq.question}>
                  <h3 className="text-sm font-semibold text-slate-200">
                    <button
                      type="button"
                      id={buttonId}
                      onClick={() => toggleFaq(index)}
                      aria-expanded={isOpen}
                      aria-controls={answerId}
                      className="w-full flex items-center justify-between p-4 text-left font-medium hover:text-white hover:bg-slate-800/30 focus:outline-none focus-visible:bg-slate-800/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                    >
                      <span className="pr-4">{faq.question}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-emerald-400' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </h3>
                  <div
                    id={answerId}
                    role="region"
                    aria-labelledby={buttonId}
                    hidden={!isOpen}
                    className="px-4 pb-4 pt-1 text-xs text-slate-300 leading-relaxed font-sans border-t border-slate-800/40 bg-slate-950/30"
                  >
                    {faq.answer}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
