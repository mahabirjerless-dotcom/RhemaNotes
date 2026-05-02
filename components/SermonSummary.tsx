import React, { useState, useCallback, useEffect } from 'react';
import { SermonSummaryOutput } from '../types';
import { Button } from './Button';
import { TranscriptTab } from './TranscriptTab';
import { ScripturesTab } from './ScripturesTab';
import { ApplyTab } from './ApplyTab';
import { NotesTab } from './NotesTab';
import { StudySystem } from './StudySystem';
import { BibleTab } from './BibleTab';
import { processSermonTranscript } from '../services/geminiService';
import { updateSermonInHistory } from '../services/storageService';
import { BookOpen, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';

interface SermonSummaryProps {
  summary: SermonSummaryOutput;
  onGoHome: () => void;
  includeReflection: boolean;
  onToggleReflection: () => void;
  isLoading: boolean;
  historyId?: string;
  onUpdateHistory?: () => void;
}





import { SermonChat } from './SermonChat';

export const SermonSummary: React.FC<SermonSummaryProps> = ({
  summary, onGoHome, includeReflection, onToggleReflection, isLoading, historyId, onUpdateHistory,
}) => {
  const [sidebarView, setSidebarView] = useState<'chat' | 'bible'>('chat');
  const [currentSummary, setCurrentSummary] = useState<SermonSummaryOutput>(summary);
  const [reflectionBusy, setReflectionBusy] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [bibleInitialRef, setBibleInitialRef] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => { setCurrentSummary(summary); }, [summary]);

  useEffect(() => {
    if (currentSummary.audio_blob) {
      const url = URL.createObjectURL(currentSummary.audio_blob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [currentSummary.audio_blob]);

  const handleCopyText = async () => {
    try {
      const points = currentSummary.key_points.map((p, i) => `${i + 1}. ${p}`).join('\n');
      const apps = currentSummary.applications.map((a, i) => `- ${a}`).join('\n');
      const text = `${currentSummary.title}\n\nKey Points:\n${points}\n\nApplication:\n${apps}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleUpdateSummarization = useCallback(async (updated: SermonSummaryOutput) => {
    setCurrentSummary(updated);
    if (historyId) {
      await updateSermonInHistory(historyId, updated);
      onUpdateHistory?.();
    }
  }, [historyId, onUpdateHistory]);

  const openInBible = useCallback((reference: string) => {
    setBibleInitialRef(reference);
    setSidebarView('bible');
  }, []);

  const handleToggleReflectionAndReprocess = useCallback(async () => {
    onToggleReflection();
    setReflectionBusy(true);
    setReflectionError(null);
    try {
      const updated = await processSermonTranscript(currentSummary.clean_transcript, !includeReflection);
      handleUpdateSummarization({
        ...updated,
        user_notes: currentSummary.user_notes,
        personal_action_items: currentSummary.personal_action_items,
      });
    } catch (err: any) {
      setReflectionError(err.message || 'Failed to update reflection.');
      onToggleReflection();
    } finally {
      setReflectionBusy(false);
    }
  }, [currentSummary, includeReflection, onToggleReflection, handleUpdateSummarization]);

  // Modal State for left-column resources
  const [activeResource, setActiveResource] = useState<'transcript' | 'notes' | 'study' | 'apply' | null>(null);

  const renderResourceContent = () => {
    switch (activeResource) {
      case 'transcript': return <TranscriptTab summary={currentSummary} onUpdateSummary={handleUpdateSummarization} />;
      case 'notes':      return <NotesTab summary={currentSummary} onUpdateSummary={handleUpdateSummarization} onOpenInBible={openInBible} />;
      case 'study':      return <StudySystem summary={currentSummary} onUpdateSummary={handleUpdateSummarization} />;
      case 'apply':      return <ApplyTab summary={currentSummary} />;
      default:           return null;
    }
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto">
      
      {/* ── Left Column (Main Content) ── */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Hero Card */}
        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 rounded-3xl p-8 border border-indigo-100 dark:border-indigo-900 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              {currentSummary.title || 'Sermon Summary'}
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400">
              <span className="flex items-center space-x-1.5">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <span>{currentSummary.main_topic}</span>
              </span>
              
              {audioUrl && (
                <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                  <audio controls className="h-8 max-w-[240px] opacity-80 hover:opacity-100 transition-opacity" src={audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
          </div>
          
          {/* Actions in top right */}
          <div className="absolute top-6 right-6 z-20 flex space-x-2">
            <button
              onClick={handleCopyText}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-800 backdrop-blur border border-indigo-100/50 dark:border-indigo-800/50 rounded-xl text-sm font-semibold text-indigo-700 dark:text-indigo-300 transition-all shadow-sm"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Notes'}</span>
            </button>
          </div>

          {/* Decorative background element */}
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Resources Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Study Resources</h3>
          <div className="space-y-3">
            {[
              { id: 'notes', label: 'Structured Notes', desc: 'Sermon breakdown and key points' },
              { id: 'apply', label: 'Action & Application', desc: 'How to apply this to your life' },
              { id: 'study', label: 'Study System', desc: 'Flashcards, Quiz, and Mind Map' },
              { id: 'transcript', label: 'Full Transcript', desc: 'Read the raw sermon text' },
            ].map(res => (
              <div key={res.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{res.label}</p>
                  <p className="text-xs text-slate-500">{res.desc}</p>
                </div>
                <Button 
                  onClick={() => setActiveResource(activeResource === res.id ? null : res.id as any)} 
                  variant={activeResource === res.id ? 'primary' : 'secondary'} 
                  className="text-xs px-4 py-1.5"
                >
                  {activeResource === res.id ? 'Close' : 'Open'}
                </Button>
              </div>
            ))}
          </div>

          {/* Active Resource Expansion */}
          {activeResource && (
            <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-4 fade-in">
              {renderResourceContent()}
            </div>
          )}
        </div>

        {/* Scriptures (Verbs-like tags) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Scriptures Mentioned</h3>
          <p className="text-xs text-slate-500 mb-5 uppercase tracking-wider font-semibold">Click to read in Bible</p>
          <div className="flex flex-wrap gap-2">
            {currentSummary.scriptures.map((scripture, i) => (
              <button
                key={i}
                onClick={() => openInBible(scripture.reference)}
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 rounded-lg text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:-translate-y-0.5 transition-all"
              >
                {scripture.reference}
              </button>
            ))}
            {currentSummary.scriptures.length === 0 && (
              <p className="text-sm text-slate-400 italic">No scriptures detected.</p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
          <label className="flex items-center space-x-3 cursor-pointer select-none">
            <button
              role="switch"
              aria-checked={includeReflection}
              onClick={handleToggleReflectionAndReprocess}
              disabled={reflectionBusy || isLoading}
              className={`
                relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                ${includeReflection ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}
                disabled:opacity-50
              `}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${includeReflection ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {reflectionBusy ? (
                <span className="flex items-center space-x-1.5 text-indigo-600 dark:text-indigo-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating reflection…</span>
                </span>
              ) : 'Include AI Reflection'}
            </span>
          </label>
          {reflectionError && <p className="text-xs text-red-500">{reflectionError}</p>}
          <Button onClick={onGoHome} variant="secondary" className="text-sm py-2 px-5">
            ← Back to Home
          </Button>
        </div>

      </div>

      {/* ── Right Column (Sidebar) ── */}
      <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col gap-6">
        
        {/* Sidebar Navigation */}
        <div className="flex bg-white dark:bg-slate-900 rounded-2xl p-1.5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <button
            onClick={() => setSidebarView('chat')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${sidebarView === 'chat' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Study Chat
          </button>
          <button
            onClick={() => setSidebarView('bible')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${sidebarView === 'bible' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Bible Reader
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[600px]">
          {sidebarView === 'chat' ? (
            <SermonChat summary={currentSummary} onUpdateSummary={handleUpdateSummarization} />
          ) : (
            <BibleTab summary={currentSummary} onUpdateSummary={handleUpdateSummarization} initialReference={bibleInitialRef} />
          )}
        </div>

      </div>

    </div>
  );
};
