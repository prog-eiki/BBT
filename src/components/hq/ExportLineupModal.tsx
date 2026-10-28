'use client';

import React, { useEffect, useState } from 'react';
import {
  Download,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ExportDimensionPreset,
  generateLineupPngDataUrl,
  sanitizeExportFilename,
} from '@/lib/export-lineup-png';
import { getMapByIdOrName } from '@/lib/valorant-data';
import type { TeamLineup, TeamPlayer } from '@/types/hq';

interface ExportLineupModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineup: TeamLineup | null;
  players: TeamPlayer[];
}

export const ExportLineupModal: React.FC<ExportLineupModalProps> = ({
  isOpen,
  onClose,
  lineup,
  players,
}) => {
  const [preset, setPreset] = useState<ExportDimensionPreset>('1920x1080');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !lineup) return;
    let cancelled = false;
    setLoading(true);

    generateLineupPngDataUrl(lineup, players, preset)
      .then((url) => {
        if (!cancelled) {
          setPreviewUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('PNG Export Fehler:', err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, lineup, players, preset]);

  if (!isOpen || !lineup) return null;

  const mapAsset = getMapByIdOrName(lineup.mapId);
  const fileName = `BBT_${sanitizeExportFilename(
    lineup.name || `${mapAsset?.name || 'Map'}_Main`
  )}_${preset}.png`;

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl bg-[#0E1015] border border-[#C8A273]/35 shadow-[0_28px_90px_rgba(0,0,0,0.95)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#9E141B] via-[#C8A273] to-[#9E141B]" />

        {/* Header */}
        <div className="px-6 py-4 bg-[#14171F] border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#C8A273]">
              <Sparkles className="w-3.5 h-3.5 text-[#9E141B]" />
              <span>E-Sports Grafik-Export • Ohne UI-Elemente</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold uppercase tracking-wider text-white">
              Lineup als PNG exportieren
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-[#090A0E] p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setPreset('1920x1080')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition ${
                  preset === '1920x1080'
                    ? 'bg-[#9E141B] text-white'
                    : 'text-[#878C8F] hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>1920 × 1080 (Standard)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreset('1080x1350')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition ${
                  preset === '1080x1350'
                    ? 'bg-[#9E141B] text-white'
                    : 'text-[#878C8F] hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>1080 × 1350 (Portrait)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-[#9E141B] text-[#878C8F] hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Canvas Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#07080A] flex flex-col items-center justify-center min-h-[340px]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-[#C8A273]">
              <Loader2 className="w-9 h-9 animate-spin text-[#9E141B]" />
              <span className="text-xs font-mono uppercase tracking-wider">
                Generiere 1920×1080 E-Sports Grafik...
              </span>
            </div>
          ) : previewUrl ? (
            <div className="w-full flex flex-col items-center">
              <div className="rounded-xl overflow-hidden border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.85)] bg-[#0A0C10]">
                <img
                  src={previewUrl}
                  alt="BBT Lineup Vorschau"
                  className="max-h-[56vh] w-auto object-contain"
                />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[#878C8F]">
                <ImageIcon className="w-3.5 h-3.5 text-[#C8A273]" />
                <span>
                  Vorschau: <strong className="text-white">{fileName}</strong> •
                  Volle Auflösung ohne Website-Buttons
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-red-400">
              Vorschau konnte nicht generiert werden.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#14171F] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[#878C8F]">
            Enthält Original BBT-Logo, Map-Banner, 5 Agent-Porträts, Spielernamen und Ersatzspieler.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider text-[#ECE8E1] transition"
            >
              Schließen
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !previewUrl}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] hover:from-[#B5171F] hover:to-[#E0242E] text-white font-display font-bold uppercase tracking-wider text-sm flex items-center gap-2 shadow-[0_0_25px_rgba(158,20,27,0.5)] transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>PNG herunterladen ({preset})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
