import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserNote } from '../types';
import { Button } from './Button';
import { Mic, StopCircle, X, Send, StickyNote, RotateCcw } from 'lucide-react';
import { saveLiveDraft, getLiveDraft, clearLiveDraft } from '../services/storageService';

interface AudioRecorderProps {
  onStopRecording: (transcript: string, notes?: UserNote[], file?: File) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onStopRecording, onCancel, isLoading, error }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);
  const [liveNotes, setLiveNotes] = useState<UserNote[]>([]);
  const liveNotesRef = useRef<UserNote[]>([]);
  const [currentDraftNote, setCurrentDraftNote] = useState<string>('');
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err: any) {
      console.warn('Wake Lock error:', err.message);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err: any) {
        console.warn('Wake Lock release error:', err.message);
      }
    }
  };
  
  useEffect(() => {
    liveNotesRef.current = liveNotes;
    if (isRecording || liveNotes.length > 0) {
      saveLiveDraft(liveNotes);
    }
  }, [liveNotes, isRecording]);

  useEffect(() => {
    const fetchDraft = async () => {
      const draft = await getLiveDraft();
      if (draft.length > 0) {
        setLiveNotes(draft);
      }
    };
    fetchDraft();
  }, []);
  
  // Visualizer and Quality Feedback state/refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioQuality, setAudioQuality] = useState<'quiet' | 'good' | 'loud' | 'none'>('none');

  const startVisualizer = (stream: MediaStream) => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    const draw = () => {
      if (!canvasRef.current || !analyserRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, width, height);
      
      // Calculate average volume for quality feedback
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      if (average < 10) setAudioQuality('quiet');
      else if (average > 100) setAudioQuality('loud');
      else setAudioQuality('good');

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height;
        
        ctx.fillStyle = `rgb(59, 130, 246)`; // Tailwind blue-500
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    setAudioQuality('none');
  };

  const addLiveNote = () => {
    if (!currentDraftNote.trim()) return;
    const newNote: UserNote = {
      id: crypto.randomUUID(),
      text: currentDraftNote,
      timestamp: Date.now(),
      timestamp_offset: recordingDuration,
    };
    setLiveNotes(prev => [...prev, newNote]);
    setCurrentDraftNote('');
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setRecordingDuration(0);
        requestWakeLock();
        startVisualizer(stream);
        intervalRef.current = window.setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        stopVisualizer();
        releaseWakeLock();
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
        }
        // Send the audio blob to be processed
        console.log('Audio recording stopped. Preparing file for transcription...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `live-sermon-${Date.now()}.webm`, { type: 'audio/webm' });
        
        await onStopRecording('', liveNotesRef.current, audioFile);
        await clearLiveDraft();

        // Stop all tracks on the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Could not start recording. Please ensure microphone access is granted.');
      setIsRecording(false);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    }
  }, [onStopRecording, liveNotes]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopVisualizer();
      releaseWakeLock();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recording Controls */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 flex flex-col items-center justify-center border border-gray-100">
          <h2 className="text-4xl font-black text-blue-950 mb-4 tracking-tight">Live Recording</h2>
          
          <div className="flex flex-col items-center justify-center w-full my-8">
            <div className={`relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-500 ${isRecording ? 'bg-red-50' : 'bg-gray-50'}`}>
              {isRecording && (
                <div className="absolute inset-0 rounded-full bg-red-500 opacity-10 animate-ping-slow"></div>
              )}
              <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 z-10 ${isRecording ? 'bg-red-600 text-white shadow-xl shadow-red-200' : 'bg-blue-600 text-white shadow-xl shadow-blue-200'}`}>
                {isRecording ? <Mic className="w-16 h-16 animate-pulse" /> : <Mic className="w-16 h-16" />}
              </div>
            </div>

            {isRecording && (
              <div className="w-full mt-8 flex flex-col items-center">
                <canvas 
                  ref={canvasRef} 
                  width={300} 
                  height={60} 
                  className="rounded-lg opacity-60 pointer-events-none"
                />
                <div className="mt-4 flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    audioQuality === 'good' ? 'bg-green-500' : 
                    audioQuality === 'quiet' ? 'bg-yellow-500' : 
                    audioQuality === 'loud' ? 'bg-red-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">
                    {audioQuality === 'good' ? 'Good Volume' : 
                     audioQuality === 'quiet' ? 'Too Quiet' : 
                     audioQuality === 'loud' ? 'Too Loud' : 'Checking...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="text-center mb-10">
            <p className="text-3xl font-black text-gray-900 mb-2">
              {formatTime(recordingDuration)}
            </p>
            <p className="text-gray-500 font-medium">
              {isRecording ? 'Capturing sermon audio...' : 'Ready to record your sermon'}
            </p>
          </div>

          <div className="flex flex-col w-full space-y-4">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                disabled={isLoading}
                className="w-full py-5 text-xl font-bold bg-blue-600 hover:bg-blue-700"
              >
                <Mic className="w-6 h-6 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                disabled={isLoading}
                className="w-full py-5 text-xl font-bold bg-red-600 hover:bg-red-700"
              >
                <StopCircle className="w-6 h-6 mr-2" />
                Stop & Process
              </Button>
            )}
            <Button
              onClick={onCancel}
              variant="secondary"
              disabled={isLoading}
              className="w-full py-4 text-gray-600"
            >
              <X className="w-5 h-5 mr-2" />
              Cancel
            </Button>
          </div>
        </div>

        {/* Live Note Taking */}
        <div className="bg-white rounded-[2.5rem] shadow-xl p-10 border border-gray-100 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-blue-950 flex items-center">
              <StickyNote className="w-6 h-6 mr-2 text-blue-600" />
              Live Notes
            </h3>
            <div className="flex items-center space-x-2">
              {liveNotes.length > 0 && (
                <button 
                  onClick={async () => {
                    if (confirm('Clear all notes?')) {
                      setLiveNotes([]);
                      await clearLiveDraft();
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Clear all notes"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-bold">
                {liveNotes.length} notes
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto mb-6 space-y-4 pr-2">
            {liveNotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 italic text-center p-8">
                <p>Add notes while you listen.</p>
                <p className="text-sm">They'll be timestamped automatically!</p>
              </div>
            ) : (
              liveNotes.map((note) => (
                <div key={note.id} className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-black text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {formatTime(note.timestamp_offset || 0)}
                    </span>
                  </div>
                  <p className="text-gray-800">{note.text}</p>
                </div>
              ))
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              value={currentDraftNote}
              onChange={(e) => setCurrentDraftNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLiveNote()}
              placeholder="Type a note and hit enter..."
              disabled={!isRecording}
              className="w-full p-4 pr-14 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all disabled:opacity-50"
            />
            <button
              onClick={addLiveNote}
              disabled={!isRecording || !currentDraftNote.trim()}
              className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:bg-gray-300"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-blue-900/40 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
          <div className="w-20 h-20 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
          <h2 className="text-3xl font-black mb-2">Creating your summary</h2>
          <p className="text-blue-100 opacity-80">Cleaning transcript and detecting scriptures...</p>
        </div>
      )}

      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-600 text-white p-4 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-8">
          {error}
        </div>
      )}
    </div>
  );
};