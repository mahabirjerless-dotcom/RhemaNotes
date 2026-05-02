import React from 'react';
import { MindMapNode } from '../types';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion } from 'motion/react';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface MindMapProps { data: MindMapNode; }

const Node: React.FC<{ node: MindMapNode; level: number }> = ({ node, level }) => {
  const isRoot = level === 0;
  const isMain = level === 1;

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: level * 0.08, type: 'spring', stiffness: 300, damping: 24 }}
        className={`
          px-5 py-3 rounded-2xl border-2 mb-6 text-center
          ${isRoot
            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-400 text-white font-black text-base shadow-glow min-w-[180px]'
            : isMain
            ? 'bg-white dark:bg-slate-800 border-blue-400 dark:border-blue-600 text-slate-900 dark:text-white font-bold text-sm shadow-soft min-w-[140px]'
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium text-xs min-w-[120px]'
          }
        `}
      >
        {node.label}
      </motion.div>

      {node.children?.length ? (
        <div className="flex space-x-8 relative pt-6">
          <div className="absolute top-0 left-1/2 w-px h-6 bg-slate-200 dark:bg-slate-700 -translate-x-1/2" />
          <div className="absolute top-6 left-[8%] right-[8%] h-px bg-slate-200 dark:bg-slate-700" />
          {node.children.map(child => (
            <div key={child.id} className="relative pt-6">
              <div className="absolute top-0 left-1/2 w-px h-6 bg-slate-200 dark:bg-slate-700 -translate-x-1/2" />
              <Node node={child} level={level + 1} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const MindMap: React.FC<MindMapProps> = ({ data }) => (
  <div className="w-full h-[520px] bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative">
    <TransformWrapper initialScale={0.75} centerOnInit minScale={0.2} maxScale={2.5}>
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          {/* Controls */}
          <div className="absolute top-4 right-4 z-10 flex flex-col space-y-1.5">
            {[
              { fn: () => zoomIn(),         Icon: ZoomIn   },
              { fn: () => zoomOut(),        Icon: ZoomOut  },
              { fn: () => resetTransform(), Icon: RefreshCw },
            ].map(({ fn, Icon }, i) => (
              <button
                key={i}
                onClick={fn}
                className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl shadow-soft border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-blue-400 transition-colors"
              >
                <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </button>
            ))}
          </div>

          <TransformComponent wrapperClass="!w-full !h-full">
            <div className="p-32 flex items-center justify-center min-w-max min-h-max">
              <Node node={data} level={0} />
            </div>
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  </div>
);
