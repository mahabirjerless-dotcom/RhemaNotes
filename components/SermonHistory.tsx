import React from 'react';
import { SermonHistoryItem } from '../types';
import { Button } from './Button';
import { BookOpen, ChevronRight, Trash2, Clock, BookMarked, Sparkles } from 'lucide-react';

interface SermonHistoryProps {
  history: SermonHistoryItem[];
  onSelectSermon: (item: SermonHistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onGoHome: () => void;
  onLoadDemo: () => void;
}

export const SermonHistory: React.FC<SermonHistoryProps> = ({
  history, onSelectSermon, onDeleteItem, onGoHome, onLoadDemo
}) => {
  const fmt = (ts: number) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Sermon History</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Your past notes and reflections</p>
        </div>
        <Button onClick={onGoHome} variant="secondary" className="text-sm py-2 px-4">
          ← Back
        </Button>
      </div>

      {history.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-16 text-center shadow-soft">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <BookMarked className="w-8 h-8 text-blue-300 dark:text-blue-700" />
          </div>
          <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-2">No sermons yet</h3>
          <p className="text-sm text-slate-400 dark:text-slate-600 mb-6">Record, upload, or paste a sermon to get started.</p>
          <div className="flex items-center justify-center space-x-3">
            <Button onClick={onGoHome} variant="secondary">Go back</Button>
            <Button onClick={onLoadDemo} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-glow">
              <Sparkles className="w-4 h-4 mr-2" />
              Load Demo Sermon
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(item => (
            <div
              key={item.id}
              className="
                group bg-white dark:bg-slate-900
                border border-slate-200 dark:border-slate-800
                rounded-2xl px-5 py-4 shadow-soft
                hover:shadow-card hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-800
                transition-all duration-200 cursor-pointer
                flex items-center justify-between gap-4
              "
              onClick={() => onSelectSermon(item)}
            >
              <div className="flex items-center space-x-4 min-w-0">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 transition-colors">
                  <BookOpen className="w-5 h-5 text-blue-500 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                    {item.summary.title || 'Untitled Sermon'}
                  </h3>
                  <div className="flex items-center space-x-1 text-xs text-slate-400 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{fmt(item.timestamp)}</span>
                    <span className="mx-1">·</span>
                    <span>{item.summary.scriptures.length} scriptures</span>
                    <span className="mx-1">·</span>
                    <span>{item.summary.key_points.length} points</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (confirm('Delete this sermon from history?')) onDeleteItem(item.id);
                  }}
                  className="p-2 text-slate-300 hover:text-red-500 dark:text-slate-700 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-700 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
