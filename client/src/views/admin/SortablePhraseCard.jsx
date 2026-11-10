import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import {
  ArrowDown,
  ArrowUp,
  Edit,
  GripVertical,
  Loader2,
  Power,
  Sparkles,
  Trash2,
  Upload,
  Volume2
} from 'lucide-react';

export default function SortablePhraseCard({
  phrase,
  categoryLabel,
  position,
  busy,
  audioActionsDisabled,
  dragDisabled,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onToggle,
  onEdit,
  onDelete,
  onPlayAudio,
  onGenerateAudio,
  onUploadAudio,
  onDeleteAudio
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: phrase.id,
    disabled: dragDisabled
  });

  const hasAudio = Boolean(phrase.audio_url || phrase.audio_key);
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 30 : undefined
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-slate-950 border-2 rounded-2xl p-4 flex flex-col justify-between ${
        phrase.is_active === 1 ? 'border-slate-800' : 'border-slate-800/40 opacity-60'
      } ${isDragging ? 'relative ring-2 ring-purple-500/70 shadow-2xl' : ''}`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              ref={setActivatorNodeRef}
              type="button"
              {...attributes}
              {...listeners}
              disabled={dragDisabled}
              style={{ touchAction: 'none' }}
              className="p-2 min-w-9 min-h-9 flex items-center justify-center text-slate-500 hover:text-purple-300 disabled:opacity-40 cursor-grab active:cursor-grabbing rounded-lg hover:bg-slate-800/80"
              title="Glisser pour réordonner dans la catégorie"
              aria-label={`Déplacer la phrase « ${phrase.text_mg} »`}
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-400/20 text-purple-300">
              {categoryLabel || phrase.category || 'salutations'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onMoveUp(phrase)}
              disabled={isFirst || dragDisabled}
              className="p-2 min-w-9 min-h-9 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-800/80"
              title="Monter dans la catégorie"
              aria-label={`Monter la phrase « ${phrase.text_mg} »`}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown(phrase)}
              disabled={isLast || dragDisabled}
              className="p-2 min-w-9 min-h-9 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-800/80"
              title="Descendre dans la catégorie"
              aria-label={`Descendre la phrase « ${phrase.text_mg} »`}
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono text-slate-500 ml-1">
              Position {position}
            </span>
          </div>
        </div>

        <h4 className="text-lg font-black text-white mt-2">{phrase.text_mg}</h4>

        {phrase.pronunciation && (
          <p className="text-[11px] text-amber-300/80 italic mt-0.5">{phrase.pronunciation}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
          <div className="bg-slate-900/70 rounded-lg px-2.5 py-2 border border-slate-800">
            <span className="text-slate-500 font-bold">FR · </span>
            <span className="text-slate-300">{phrase.text_fr || '—'}</span>
          </div>
          <div className="bg-slate-900/70 rounded-lg px-2.5 py-2 border border-slate-800">
            <span className="text-slate-500 font-bold">EN · </span>
            <span className="text-slate-300">{phrase.text_en || '—'}</span>
          </div>
        </div>

        <div className="mt-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-[11px] font-semibold">
              <Volume2 className={`w-4 h-4 ${hasAudio ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className={hasAudio ? 'text-emerald-300' : 'text-slate-500'}>
                {hasAudio ? 'Audio disponible' : 'Aucun fichier audio'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasAudio && (
                <button
                  type="button"
                  onClick={() => onPlayAudio(phrase)}
                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Écouter</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onGenerateAudio(phrase)}
                disabled={audioActionsDisabled}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold"
              >
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{busy ? 'Génération…' : hasAudio ? 'Régénérer l’audio' : 'Générer l’audio'}</span>
              </button>

              <label
                htmlFor={`phrase-audio-${phrase.id}`}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer</span>
              </label>
              <input
                id={`phrase-audio-${phrase.id}`}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm,.aac"
                className="hidden"
                onChange={(e) => {
                  onUploadAudio(phrase, e.target.files?.[0]);
                  e.target.value = '';
                }}
              />

              {hasAudio && (
                <button
                  type="button"
                  onClick={() => onDeleteAudio(phrase)}
                  className="p-1.5 text-rose-400 hover:text-rose-300"
                  title="Supprimer l’audio"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800 text-xs">
        <button
          onClick={() => onToggle(phrase)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold ${
            phrase.is_active === 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          <span>{phrase.is_active === 1 ? 'Active' : 'Masquée'}</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onEdit(phrase)}
            className="text-amber-400 hover:text-amber-300 p-1.5"
            title="Modifier"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(phrase)}
            className="text-rose-400 hover:text-rose-300 p-1.5"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
