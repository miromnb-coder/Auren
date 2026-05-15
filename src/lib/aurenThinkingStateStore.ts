import type { AurenThinkingEvent } from './auren-agent/core/types';

export type AurenVisibleThinkingState = AurenThinkingEvent;

type ThinkingListener = (thinkingState: AurenVisibleThinkingState | null) => void;

const listeners = new Set<ThinkingListener>();
let currentThinkingState: AurenVisibleThinkingState | null = null;

const notifyListeners = () => {
  for (const listener of listeners) {
    listener(currentThinkingState);
  }
};

export const getAurenThinkingState = () => currentThinkingState;

export const setAurenThinkingState = (thinkingState: AurenVisibleThinkingState | null) => {
  currentThinkingState = thinkingState;
  notifyListeners();
};

export const clearAurenThinkingState = () => {
  setAurenThinkingState(null);
};

export const subscribeToAurenThinkingState = (listener: ThinkingListener) => {
  listeners.add(listener);
  listener(currentThinkingState);

  return () => {
    listeners.delete(listener);
  };
};
