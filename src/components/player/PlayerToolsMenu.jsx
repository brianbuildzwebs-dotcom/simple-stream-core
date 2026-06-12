import React, { useState, useRef, useEffect } from 'react';
import { PictureInPicture2, Sparkles, Languages, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const COMING_SOON = {
  enhance: {
    title: 'Enhance',
    description: 'AI video and audio enhancement is on the way.',
  },
  translate: {
    title: 'Translate Audio',
    description: 'Live audio translation is coming soon. You will be able to hear the stream in your language.',
  },
};

export default function PlayerToolsMenu({ videoRef, visible = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!menuOpen && !activePanel) return undefined;

    const handlePointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setMenuOpen(false);
        setActivePanel(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen, activePanel]);

  useEffect(() => {
    if (!visible) {
      setMenuOpen(false);
      setActivePanel(null);
    }
  }, [visible]);

  const handlePictureInPicture = async () => {
    const video = videoRef?.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
      setMenuOpen(false);
      setActivePanel(null);
    } catch {
      setActivePanel('pip-error');
    }
  };

  const openComingSoon = (key) => {
    setActivePanel(key);
    setMenuOpen(false);
  };

  const panel = activePanel ? COMING_SOON[activePanel] : null;

  return (
    <div
      ref={rootRef}
      className="absolute top-3 left-1/2 z-30 -translate-x-1/2 pointer-events-auto"
      onMouseEnter={() => setMenuOpen(true)}
      onMouseLeave={() => {
        if (!activePanel) setMenuOpen(false);
      }}
    >
      <AnimatePresence>
        {(menuOpen || activePanel) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mb-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 p-1 shadow-lg backdrop-blur-md"
          >
            <button
              type="button"
              onClick={handlePictureInPicture}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/10"
              title="Picture in Picture"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PiP</span>
            </button>
            <button
              type="button"
              onClick={() => openComingSoon('enhance')}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/10"
              title="Enhance"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Enhance</span>
            </button>
            <button
              type="button"
              onClick={() => openComingSoon('translate')}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/10"
              title="Translate Audio"
            >
              <Languages className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Translate</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => {
          setMenuOpen((open) => !open);
          if (activePanel) setActivePanel(null);
        }}
        className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
        aria-label="Player tools"
        aria-expanded={menuOpen || !!activePanel}
      >
        <span className="text-sm font-bold leading-none">⋯</span>
      </button>

      <AnimatePresence>
        {panel && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="absolute left-1/2 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-white/10 bg-black/85 p-4 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{panel.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/60">{panel.description}</p>
                <p className="mt-3 inline-flex rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Coming soon
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
        {activePanel === 'pip-error' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-black/85 p-3 text-center text-xs text-white/70 backdrop-blur-md"
          >
            Picture in Picture is not available in this browser.
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              className="mt-2 block w-full text-primary hover:underline"
            >
              OK
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}