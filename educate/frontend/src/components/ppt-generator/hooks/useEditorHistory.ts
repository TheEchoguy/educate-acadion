/**
 * Presentation Editor History & State Hook (Phase 2.3).
 * Manages working presentation state, undo/redo stacks, and uncommitted change detection.
 */

import { useState, useCallback, useMemo } from 'react';
import type { PresentationEditorModel } from '../types/editor';

const MAX_HISTORY_ENTRIES = 50;

export interface EditorHistoryState {
  originalModel: PresentationEditorModel | null;
  workingModel: PresentationEditorModel | null;
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
  historyLength: number;
  past: PresentationEditorModel[];
  future: PresentationEditorModel[];
  initModel: (model: PresentationEditorModel) => void;
  applyChange: (updatedModel: PresentationEditorModel) => void;
  undo: () => void;
  redo: () => void;
  resetToOriginal: () => void;
}

export function useEditorHistory(): EditorHistoryState {
  const [originalModel, setOriginalModel] = useState<PresentationEditorModel | null>(null);
  const [workingModel, setWorkingModel] = useState<PresentationEditorModel | null>(null);
  const [past, setPast] = useState<PresentationEditorModel[]>([]);
  const [future, setFuture] = useState<PresentationEditorModel[]>([]);

  // Initialize or reinitialize with a freshly loaded presentation
  const initModel = useCallback((model: PresentationEditorModel) => {
    // Deep clone to ensure original remains untouched
    const cloned = JSON.parse(JSON.stringify(model));
    setOriginalModel(cloned);
    setWorkingModel(cloned);
    setPast([]);
    setFuture([]);
  }, []);

  // Apply a new working model update, recording the previous state in history
  const applyChange = useCallback(
    (updatedModel: PresentationEditorModel) => {
      setWorkingModel((current) => {
        if (!current) return updatedModel;

        // Push current working model into undo history stack
        setPast((prevPast) => {
          const nextPast = [...prevPast, current];
          if (nextPast.length > MAX_HISTORY_ENTRIES) {
            return nextPast.slice(nextPast.length - MAX_HISTORY_ENTRIES);
          }
          return nextPast;
        });

        // Any new change clears the redo history stack
        setFuture([]);

        return updatedModel;
      });
    },
    []
  );

  // Undo the last operation
  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;

      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);

      setWorkingModel((current) => {
        if (current) {
          setFuture((prevFuture) => [current, ...prevFuture]);
        }
        return previous;
      });

      return newPast;
    });
  }, []);

  // Redo the previously undone operation
  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;

      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);

      setWorkingModel((current) => {
        if (current) {
          setPast((prevPast) => [...prevPast, current]);
        }
        return next;
      });

      return newFuture;
    });
  }, []);

  // Reset in-memory changes back to the original parsed model
  const resetToOriginal = useCallback(() => {
    if (originalModel) {
      const cloned = JSON.parse(JSON.stringify(originalModel));
      setWorkingModel(cloned);
      setPast([]);
      setFuture([]);
    }
  }, [originalModel]);

  // Determine whether any edits differ from the original
  const hasUnsavedChanges = useMemo(() => {
    if (!originalModel || !workingModel) return false;
    return past.length > 0 || originalModel !== workingModel;
  }, [originalModel, workingModel, past.length]);

  return {
    originalModel,
    workingModel,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    hasUnsavedChanges,
    historyLength: past.length,
    past,
    future,
    initModel,
    applyChange,
    undo,
    redo,
    resetToOriginal,
  };
}
