// tests/screens.test.js
import { describe, it, expect, vi } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createGameState } from '../src/state.js';
import { startFight } from '../src/game.js';
import { mount, wire } from '../src/ui/screens.js';

describe('mount', () => {
  it('renders the hub when phase is HUB', () => {
    const el = document.createElement('div');
    mount(el, createGameState(1, CONFIG), CONFIG);
    expect(el.querySelector('[data-action="next-fight"]')).not.toBeNull();
  });

  it('renders the fight screen when phase is FIGHT', () => {
    const el = document.createElement('div');
    mount(el, startFight(createGameState(1, CONFIG), CONFIG), CONFIG);
    expect(el.querySelector('[data-action="strike"]')).not.toBeNull();
  });
});

describe('wire', () => {
  it('routes a data-action click to the matching handler', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button data-action="next-fight">Go</button>';
    const handlers = { 'next-fight': vi.fn() };
    wire(el, handlers);
    el.querySelector('button').click();
    expect(handlers['next-fight']).toHaveBeenCalledTimes(1);
  });

  it('passes the clicked element to the handler', () => {
    const el = document.createElement('div');
    el.innerHTML = '<button data-action="train-power">T</button>';
    const handler = vi.fn();
    wire(el, { 'train-power': handler });
    const button = el.querySelector('button');
    button.click();
    expect(handler).toHaveBeenCalledWith(button);
  });

  it('ignores clicks on elements without a data-action', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>nope</span>';
    const handler = vi.fn();
    wire(el, { anything: handler });
    el.querySelector('span').click();
    expect(handler).not.toHaveBeenCalled();
  });
});
