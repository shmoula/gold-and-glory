// src/ui/screens.js
import { PHASE } from '../state.js';
import { renderHub, renderFight, renderResult, renderGameOver } from './render.js';

export function mount(container, state, config) {
  let html;
  switch (state.phase) {
    case PHASE.HUB: html = renderHub(state, config); break;
    case PHASE.FIGHT: html = renderFight(state, config); break;
    case PHASE.RESULT: html = renderResult(state, config); break;
    case PHASE.GAMEOVER: html = renderGameOver(state, config); break;
    default: html = '<p>Unknown phase</p>';
  }
  container.innerHTML = html;
}

// Attaches one delegated click listener. handlers is { actionName: (el) => void }.
export function wire(container, handlers) {
  container.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || !container.contains(target)) return;
    const action = target.getAttribute('data-action');
    const handler = handlers[action];
    if (handler) handler(target);
  });
}
