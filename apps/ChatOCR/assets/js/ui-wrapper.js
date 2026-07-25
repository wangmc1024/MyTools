/**
 * ui-wrapper.js — Chat-facing facade over ui.js.
 * Holds the singleton ribbon instance so chat.js can drive it.
 */
import * as ui from './ui.js';

export const ribbon = { current: null };

export function attachRibbon(el) {
  ribbon.current = ui.makeRibbon(el);
  ribbon.current.idle();
  return ribbon.current;
}

export const { appendMessage, appendThinking, toast, typewriter, renderMarkdown, openLightbox } = ui;
