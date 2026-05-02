import React from 'react';
import { TabProps } from '../types';
import { BookOpen, BookMarked } from 'lucide-react';

interface ScripturesTabProps extends TabProps {
  onOpenInBible?: (reference: string) => void;
}

export const ScripturesTab: React.FC<ScripturesTabProps> = ({ summary, onOpenInBible }) => {
  if (!summary.scriptures?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-8">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookMarked className="w-8 h-8 text-slate-300 dark:text-slate-600" />
        </div>
        <p className="font-semibold text-slate-500 dark:text-slate-400">No scripture references detected</p>
        <p className="text-sm text-slate-400 dark:text-slate-600 mt-1">They'll appear here once the sermon is processed.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-6">
        {summary.scriptures.length} reference{summary.scriptures.length !== 1 ? 's' : ''} detected
      </p>

      {summary.scriptures.map((scripture, index) => (
        <div
          key={index}
          className="
            group bg-white dark:bg-slate-800/60
            border border-slate-200 dark:border-slate-700
            rounded-2xl p-5
            hover:border-blue-200 dark:hover:border-blue-800
            hover:-translate-y-0.5 hover:shadow-card
            transition-all duration-200
          "
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="text-base font-black text-blue-700 dark:text-blue-400">{scripture.reference}</h3>
            {onOpenInBible && (
              <button
                onClick={() => onOpenInBible(scripture.reference)}
                className="
                  flex-shrink-0 flex items-center space-x-1.5
                  text-xs font-bold text-blue-600 dark:text-blue-400
                  bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900
                  px-3 py-1.5 rounded-full
                  hover:bg-blue-100 dark:hover:bg-blue-900
                  transition-colors
                "
              >
                <BookOpen className="w-3 h-3" />
                <span>Read</span>
              </button>
            )}
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
            <span className="font-semibold text-slate-900 dark:text-white">Meaning: </span>
            {scripture.plain_meaning}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed italic">
            <span className="not-italic font-semibold text-slate-600 dark:text-slate-300">Usage: </span>
            {scripture.speaker_usage}
          </p>
        </div>
      ))}
    </div>
  );
};
