import React from 'react';
import { TabProps } from '../types';
import { Target, Quote, Lightbulb, HelpCircle, Heart, Zap } from 'lucide-react';

const Section: React.FC<{
  icon: React.ElementType;
  iconColor: string;
  title: string;
  children: React.ReactNode;
}> = ({ icon: Icon, iconColor, title, children }) => (
  <div>
    <div className="flex items-center space-x-2 mb-4">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h4>
    </div>
    {children}
  </div>
);

export const ApplyTab: React.FC<TabProps> = ({ summary }) => {
  const hasReflection =
    summary.reflection &&
    (summary.reflection.takeaway || summary.reflection.reflection_text || summary.reflection.prayer);

  return (
    <div className="p-6 md:p-8 space-y-10">

      {summary.main_topic && (
        <Section icon={Target} iconColor="text-blue-500" title="Main Topic">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{summary.main_topic}</p>
        </Section>
      )}

      {summary.key_points?.length > 0 && (
        <Section icon={Zap} iconColor="text-amber-500" title="Key Points">
          <ul className="space-y-2">
            {summary.key_points.map((point, i) => (
              <li key={i} className="flex items-start space-x-3">
                <span className="mt-1 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-black flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.quotes?.length > 0 && (
        <Section icon={Quote} iconColor="text-indigo-500" title="Notable Quotes">
          <div className="space-y-3">
            {summary.quotes.map((quote, i) => (
              <blockquote
                key={i}
                className="border-l-4 border-indigo-300 dark:border-indigo-700 pl-4 py-1 italic text-slate-600 dark:text-slate-400"
              >
                &ldquo;{quote}&rdquo;
              </blockquote>
            ))}
          </div>
        </Section>
      )}

      {summary.applications?.length > 0 && (
        <Section icon={Target} iconColor="text-emerald-500" title="Practical Applications">
          <ul className="space-y-2">
            {summary.applications.map((app, i) => (
              <li key={i} className="flex items-start space-x-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{app}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.actionable_insights?.length > 0 && (
        <Section icon={Lightbulb} iconColor="text-yellow-500" title="Actionable Insights">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.actionable_insights.map((insight, i) => (
              <div
                key={i}
                className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded-xl p-4"
              >
                <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {summary.open_questions?.length > 0 && (
        <Section icon={HelpCircle} iconColor="text-violet-500" title="Questions Raised">
          <ul className="space-y-2">
            {summary.open_questions.map((q, i) => (
              <li key={i} className="flex items-start space-x-3">
                <HelpCircle className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{q}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {summary.reflection && (
        hasReflection ? (
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-100 dark:border-blue-900 p-6 space-y-5">
            <div className="flex items-center space-x-2 mb-2">
              <Heart className="w-4 h-4 text-blue-500" />
              <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Personal Reflection</h4>
            </div>
            {summary.reflection.takeaway && (
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Takeaway</p>
                <p className="text-slate-700 dark:text-slate-300 italic leading-relaxed">{summary.reflection.takeaway}</p>
              </div>
            )}
            {summary.reflection.reflection_text && (
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Reflection</p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{summary.reflection.reflection_text}</p>
              </div>
            )}
            {summary.reflection.prayer && (
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Prayer</p>
                <p className="text-slate-700 dark:text-slate-300 italic leading-relaxed">{summary.reflection.prayer}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-600 italic text-center py-4 border-t border-slate-100 dark:border-slate-800">
            Toggle "Include Reflection" below to generate a personal reflection.
          </p>
        )
      )}
    </div>
  );
};
