import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Button } from './components/Button';
import { AudioRecorder } from './components/AudioRecorder';
import { SermonSummary } from './components/SermonSummary';
import { SermonHistory } from './components/SermonHistory';
import { processSermonTranscript, processSermonFile, processSermonYoutubeUrl } from './services/geminiService';
import { getYouTubeTranscript } from './services/youtubeService';
import { getSermonHistory, saveSermonToHistory, deleteSermonFromHistory } from './services/storageService';
import { SermonSummaryOutput, SermonHistoryItem, UserNote } from './types';
import { DEMO_SERMON } from './demoSermon';
import {
  BookOpen, Mic, Upload, FileAudio, FileVideo,
  FileText, Video as Youtube, Headphones, ArrowRight,
  Sparkles, Clock, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';

type AppScreen = 'home' | 'listening' | 'summary' | 'upload' | 'history' | 'youtube';

// ── Processing overlay ────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  'Fetching transcript…',
  'Cleaning transcript…',
  'Detecting scripture references…',
  'Analysing key themes…',
  'Building study tools…',
  'Generating quiz & flashcards…',
  'Almost there…',
];

const ProcessingOverlay: React.FC<{ youtubeStep?: string }> = ({ youtubeStep }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep(s => (s + 1) % PROCESSING_STEPS.length);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md">
      {/* Orbiting dots */}
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-glow">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
        </div>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="orbit absolute top-1/2 left-1/2 w-3 h-3 -mt-1.5 -ml-1.5 rounded-full bg-blue-400"
            style={{ animationDelay: `${i * 0.66}s`, animationDuration: '2s' }}
          />
        ))}
      </div>

      <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Processing your sermon</h2>

      <div className="h-6 overflow-hidden">
        <p key={youtubeStep ?? step} className="text-blue-300 text-sm font-medium animate-fade-up">
          {youtubeStep ?? PROCESSING_STEPS[step]}
        </p>
      </div>

      <div className="mt-8 w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-[2600ms] ease-linear"
          style={{ width: `${((step + 1) / PROCESSING_STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
};

// ── Home screen input card ────────────────────────────────────────────────────

interface InputCardProps {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  onClick: () => void;
}

const InputCard: React.FC<InputCardProps> = ({
  icon: Icon, iconBg, iconColor, title, description, onClick,
}) => (
  <button
    onClick={onClick}
    className="
      group relative flex flex-col items-center text-center
      bg-white dark:bg-slate-900
      border border-slate-200 dark:border-slate-800
      rounded-3xl p-8 shadow-soft
      hover:shadow-card hover:-translate-y-1 hover:border-blue-200 dark:hover:border-blue-800
      transition-all duration-200 ease-out
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    "
  >
    <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200`}>
      <Icon className={`w-7 h-7 ${iconColor}`} />
    </div>
    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">{title}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
    <div className="mt-5 flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
      Get started <ArrowRight className="w-3 h-3 ml-1" />
    </div>
  </button>
);

// ── Main App ──────────────────────────────────────────────────────────────────

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sermonOutput, setSermonOutput] = useState<SermonSummaryOutput | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [includeReflection, setIncludeReflection] = useState(false);
  const [history, setHistory] = useState<SermonHistoryItem[]>([]);
  const [initialUploadMode, setInitialUploadMode] = useState<'text' | 'file'>('text');
  const [youtubeStep, setYoutubeStep] = useState<string | undefined>();

  useEffect(() => { 
    getSermonHistory().then(setHistory); 
  }, []);

  const handleProcessTranscript = useCallback(async (transcript: string, liveNotes?: UserNote[], file?: File) => {
    setIsLoading(true);
    setError(null);
    try {
      let result;
      if (file) {
        result = await processSermonFile(file, includeReflection);
        result.audio_blob = file;
      } else {
        result = await processSermonTranscript(transcript, includeReflection);
      }
      if (liveNotes) result.user_notes = [...(result.user_notes || []), ...liveNotes];
      const savedItem = await saveSermonToHistory(result);
      setHistory(prev => [savedItem, ...prev]);
      setSermonOutput(result);
      setSelectedHistoryId(savedItem.id);
      setCurrentScreen('summary');
    } catch (err: any) {
      setError(err.message || 'Failed to process sermon. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [includeReflection]);

  const handleProcessFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await processSermonFile(file, includeReflection);
      result.audio_blob = file;
      const savedItem = await saveSermonToHistory(result);
      setHistory(prev => [savedItem, ...prev]);
      setSermonOutput(result);
      setSelectedHistoryId(savedItem.id);
      setCurrentScreen('summary');
    } catch (err: any) {
      setError(err.message || 'Failed to process file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [includeReflection]);

  const handleSelectSermon = useCallback((item: SermonHistoryItem) => {
    setSermonOutput(item.summary);
    setSelectedHistoryId(item.id);
    setCurrentScreen('summary');
  }, []);

  const handleToggleReflection = useCallback(() => setIncludeReflection(p => !p), []);
  const handleUpdateHistory = useCallback(async () => {
    const newHistory = await getSermonHistory();
    setHistory(newHistory);
  }, []);

  const handleDeleteItem = async (id: string) => {
    await deleteSermonFromHistory(id);
    setHistory(prev => prev.filter(i => i.id !== id));
    if (selectedHistoryId === id) {
      setCurrentScreen('history');
      setSermonOutput(null);
      setSelectedHistoryId(undefined);
    }
  };

  const handleLoadDemo = async () => {
    setIsLoading(true);
    // Simulate a brief loading delay so it feels like it's processing
    await new Promise(resolve => setTimeout(resolve, 800));
    const savedItem = await saveSermonToHistory(DEMO_SERMON);
    setHistory(prev => [savedItem, ...prev]);
    setSermonOutput(DEMO_SERMON);
    setSelectedHistoryId(savedItem.id);
    setCurrentScreen('summary');
    setIsLoading(false);
  };

  const handleGoHome = useCallback(() => {
    setCurrentScreen('home');
    setSermonOutput(null);
    setSelectedHistoryId(null);
    setError(null);
    setIncludeReflection(false);
  }, []);

  const handleNavigate = useCallback((screen: AppScreen) => {
    setCurrentScreen(screen);
    if (screen === 'home') { setSermonOutput(null); setSelectedHistoryId(null); }
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      /* ── Home ── */
      case 'home':
        return (
          <div className="flex flex-col items-center space-y-16 py-6 animate-in fade-in duration-500">
            {/* Hero */}
            <div className="text-center space-y-5 max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-900">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI-powered sermon study</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
                Every sermon,<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  deeply understood.
                </span>
              </h1>
              <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                Record live, upload audio, or paste a transcript. SpiritScribe turns any sermon into
                structured notes, scripture links, quizzes, and a personal Bible reader.
              </p>
            </div>

            {/* Input method cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
              <InputCard
                icon={Mic}
                iconBg="bg-red-50 dark:bg-red-950"
                iconColor="text-red-500"
                title="Record Live"
                description="One tap at church. Add timestamped notes while you listen."
                onClick={() => setCurrentScreen('listening')}
              />
              <InputCard
                icon={Youtube}
                iconBg="bg-red-50 dark:bg-red-950"
                iconColor="text-red-500"
                title="YouTube Link"
                description="Paste a link. Title and transcript extracted automatically."
                onClick={() => setCurrentScreen('youtube')}
              />
              <InputCard
                icon={Headphones}
                iconBg="bg-blue-50 dark:bg-blue-950"
                iconColor="text-blue-600"
                title="Upload Audio"
                description="Import MP3, M4A, or any audio file from your device."
                onClick={() => { setInitialUploadMode('file'); setCurrentScreen('upload'); }}
              />
              <InputCard
                icon={FileText}
                iconBg="bg-green-50 dark:bg-green-950"
                iconColor="text-green-600"
                title="Paste Text"
                description="Drop in raw notes or transcript. Perfect for existing study materials."
                onClick={() => {
                  setInitialUploadMode('text');
                  setCurrentScreen('upload');
                }}
              />
              <InputCard
                icon={Sparkles}
                iconBg="bg-purple-50 dark:bg-purple-950"
                iconColor="text-purple-600"
                title="Try a Demo"
                description="Instantly view a pre-processed sermon to see the app's full capabilities."
                onClick={handleLoadDemo}
              />
            </div>

            {/* Recent sermons */}
            {history.length > 0 && (
              <div className="w-full">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent sermons</h2>
                  <button
                    onClick={() => setCurrentScreen('history')}
                    className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline underline-offset-4 flex items-center space-x-1"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {history.slice(0, 3).map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectSermon(item)}
                      className="
                        group text-left bg-white dark:bg-slate-900
                        border border-slate-200 dark:border-slate-800
                        rounded-2xl p-5 shadow-soft
                        hover:shadow-card hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-800
                        transition-all duration-200
                      "
                    >
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                        {item.summary.title}
                      </h4>
                      <div className="flex items-center text-xs text-slate-400 mb-3 space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex space-x-2">
                        <span className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                          {item.summary.scriptures.length} SCRIPTURES
                        </span>
                        <span className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                          {item.summary.key_points.length} POINTS
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'listening':
        return (
          <AudioRecorder
            onStopRecording={handleProcessTranscript}
            onCancel={() => setCurrentScreen('home')}
            isLoading={isLoading}
            error={error}
          />
        );

      case 'upload':
        return (
          <UploadSermon
            onProcessTranscript={handleProcessTranscript}
            onProcessFile={handleProcessFile}
            onCancel={() => setCurrentScreen('home')}
            isLoading={isLoading}
            error={error}
            initialMode={initialUploadMode}
          />
        );

      case 'youtube':
        return (
          <YouTubeProcessor
            onProcessUrl={async (url) => {
              setIsLoading(true);
              setError(null);
              setYoutubeStep('Fetching and Analysing YouTube sermon…');
              try {
                // Hand off to Gemini which natively supports scraping YouTube URLs
                const result = await processSermonYoutubeUrl(url, includeReflection);

                // Ensure there is a title
                if (!result.title || result.title === 'Sermon Summary') {
                  result.title = 'YouTube Sermon Summary';
                }

                const savedItem = await saveSermonToHistory(result);
                setHistory(prev => [savedItem, ...prev]);
                setSermonOutput(result);
                setSelectedHistoryId(savedItem.id);
                setCurrentScreen('summary');
              } catch (err: any) {
                setError(err.message || 'Failed to process YouTube link.');
              } finally {
                setIsLoading(false);
                setYoutubeStep(undefined);
              }
            }}
            onCancel={() => setCurrentScreen('home')}
            isLoading={isLoading}
          />
        );

      case 'history':
        return (
          <SermonHistory
            history={history}
            onSelectSermon={handleSelectSermon}
            onDeleteItem={handleDeleteItem}
            onGoHome={handleGoHome}
            onLoadDemo={handleLoadDemo}
          />
        );

      case 'summary':
        return sermonOutput ? (
          <SermonSummary
            summary={sermonOutput}
            onGoHome={handleGoHome}
            includeReflection={includeReflection}
            onToggleReflection={handleToggleReflection}
            isLoading={isLoading}
            historyId={selectedHistoryId || undefined}
            onUpdateHistory={handleUpdateHistory}
          />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <p className="text-slate-500 mb-4">No sermon summary available.</p>
            <Button onClick={handleGoHome} variant="secondary">Go Home</Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Layout onNavigate={handleNavigate} currentScreen={currentScreen}>
      {renderScreen()}

      {/* Processing overlay */}
      {isLoading && <ProcessingOverlay youtubeStep={youtubeStep} />}

      {/* Error toast */}
      {error && !isLoading && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-4 flex items-center space-x-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
    </Layout>
  );
}

// ── Upload screen ─────────────────────────────────────────────────────────────

interface UploadSermonProps {
  onProcessTranscript: (t: string, n?: UserNote[]) => Promise<void>;
  onProcessFile: (f: File) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
  initialMode?: 'text' | 'file';
}

const UploadSermon: React.FC<UploadSermonProps> = ({
  onProcessTranscript, onProcessFile, onCancel, isLoading, error, initialMode = 'text',
}) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'text' | 'file'>(initialMode);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handle = async () => {
    setBusy(true);
    if (mode === 'text') await onProcessTranscript(text);
    else if (file)       await onProcessFile(file);
    setBusy(false);
  };

  const disabled = isLoading || busy || (mode === 'text' ? !text.trim() : !file);

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-card border border-slate-200 dark:border-slate-800 p-8 md:p-12">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-8 tracking-tight">Upload a sermon</h2>

        {/* Mode toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-8 w-full max-w-xs">
          {(['text', 'file'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                mode === m
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {m === 'text' ? <FileText className="w-4 h-4" /> : <FileAudio className="w-4 h-4" />}
              <span>{m === 'text' ? 'Paste Text' : 'Audio / Video'}</span>
            </button>
          ))}
        </div>

        {mode === 'text' ? (
          <textarea
            className="
              w-full h-64 p-5 mb-6
              bg-slate-50 dark:bg-slate-800
              border border-slate-200 dark:border-slate-700
              rounded-2xl resize-none text-slate-800 dark:text-slate-100
              placeholder:text-slate-400 leading-relaxed
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              transition-all
            "
            placeholder="Paste your sermon transcript here…"
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={isLoading || busy}
          />
        ) : (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              className="
                w-full h-52 mb-2 rounded-2xl
                border-2 border-dashed border-slate-200 dark:border-slate-700
                flex flex-col items-center justify-center cursor-pointer
                hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30
                transition-all group
              "
            >
              <input ref={fileRef} type="file" className="hidden" accept="audio/*,video/*" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
              {file ? (
                <div className="text-center">
                  <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    {file.type.startsWith('video') ? <FileVideo className="w-7 h-7 text-blue-600" /> : <FileAudio className="w-7 h-7 text-blue-600" />}
                  </div>
                  <p className="font-bold text-slate-800 dark:text-white">{file.name}</p>
                  <p className="text-sm text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · click to change</p>
                </div>
              ) : (
                <div className="text-center px-8">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Click to select a file</p>
                  <p className="text-sm text-slate-400 mt-1">MP3, MP4, WAV, M4A and more</p>
                </div>
              )}
            </div>
            {file && file.size > 20 * 1024 * 1024 && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mb-4 text-center">
                Warning: Files over 20MB may exceed browser memory limits.
              </p>
            )}
            {!file || file.size <= 20 * 1024 * 1024 ? <div className="mb-4"></div> : null}
          </>
        )}

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl p-4">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handle} disabled={disabled} className="flex-1 py-3">
            {busy || isLoading ? (
              <span className="flex items-center space-x-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing…</span>
              </span>
            ) : 'Process Sermon'}
          </Button>
          <Button onClick={onCancel} variant="secondary" disabled={isLoading || busy} className="flex-1 py-3">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── YouTube screen ────────────────────────────────────────────────────────────

interface YouTubeProcessorProps {
  onProcessUrl: (url: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

const YouTubeProcessor: React.FC<YouTubeProcessorProps> = ({ onProcessUrl, onCancel, isLoading }) => {
  const [url, setUrl] = useState('');

  const handle = () => {
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      alert('Please enter a valid YouTube URL.');
      return;
    }
    onProcessUrl(url);
  };

  // What the two-step pipeline does — shown as a checklist before the user submits
  const steps = [
    { label: 'Extract real captions from YouTube',    detail: 'Auto-generated or manual subtitles' },
    { label: 'Detect every scripture reference',      detail: 'Linked directly to the Bible reader' },
    { label: 'Generate full study guide',             detail: 'Quiz, flashcards, mind map & chat' },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-card border border-slate-200 dark:border-slate-800 p-8 md:p-10 flex flex-col items-center">

        {/* Icon */}
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950 rounded-2xl flex items-center justify-center mb-5">
          <Youtube className="w-8 h-8 text-red-500" />
        </div>

        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">YouTube Sermon</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-7 max-w-sm">
          Paste any YouTube sermon link. We'll pull the real transcript and turn it into a full study guide.
        </p>

        {/* What happens checklist */}
        <div className="w-full bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 mb-7 space-y-3">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start space-x-3">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.label}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* URL input */}
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isLoading && handle()}
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={isLoading}
          className="
            w-full p-4 mb-2
            bg-slate-50 dark:bg-slate-800
            border border-slate-200 dark:border-slate-700
            rounded-2xl text-slate-800 dark:text-slate-100
            placeholder:text-slate-400
            focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500
            disabled:opacity-50 transition-all
          "
        />

        {/* Caveat */}
        <p className="text-[11px] text-slate-400 dark:text-slate-600 mb-6 text-center">
          Works with videos that have captions enabled (auto-generated or manual).
          Private or age-restricted videos are not supported.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button
            onClick={handle}
            disabled={isLoading || !url.trim()}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 focus:ring-red-400"
          >
            {isLoading ? (
              <span className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing…</span>
              </span>
            ) : 'Extract & Analyse'}
          </Button>
          <Button onClick={onCancel} variant="secondary" disabled={isLoading} className="flex-1 py-3">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default App;
