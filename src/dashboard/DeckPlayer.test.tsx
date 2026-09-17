import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DeckPlayer } from './DeckPlayer';

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const slides = Array.from({ length: 9 }, (_, i) => <div key={i}>Content {i + 1}</div>);
function Harness({ start = 1 }: { start?: number }) { const [slide, change] = useState(start); return <DeckPlayer slide={slide} onSlideChange={change} slides={slides}/>; }

describe('Slide player', () => {
  it('cleans up the old slide in StrictMode after an interrupted transition', () => {
    vi.useFakeTimers();
    const { container } = render(<StrictMode><Harness/></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: 'Следующий слайд' }));
    act(() => vi.advanceTimersByTime(150));
    fireEvent.click(screen.getByRole('button', { name: 'Следующий слайд' }));
    expect(container.querySelector('.sales-deck')?.getAttribute('data-slide')).toBe('3');
    expect(container.querySelectorAll('.deck-stage-leave')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1500));
    expect(container.querySelectorAll('.deck-stage-leave')).toHaveLength(0);
    expect(container.querySelector('.deck-stage-active')?.textContent).toBe('Content 3');
  });
  it('crosses the section boundary instead of disabling the arrow', () => {
    const next = vi.fn(), previous = vi.fn(), change = vi.fn();
    const { rerender } = render(<DeckPlayer slide={9} slides={slides} onSlideChange={change} onNextSection={next}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Следующий раздел: Результаты' }));
    expect(next).toHaveBeenCalledOnce(); expect(change).not.toHaveBeenCalled();
    rerender(<DeckPlayer slide={1} slides={slides} onSlideChange={change} onPreviousSection={previous}/>);
    fireEvent.keyDown(window, { key: 'ArrowLeft' }); expect(previous).toHaveBeenCalledOnce();
  });
  it('leaves text fields, modified keystrokes and the open overview alone', () => {
    const change = vi.fn();
    render(<><input aria-label="Search"/><DeckPlayer slide={3} onSlideChange={change} slides={slides}/></>);
    fireEvent.keyDown(screen.getByLabelText('Search'), { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Все слайды' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /09.*Проводится пилот/ }));
    expect(change).toHaveBeenCalledWith(9);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('normalizes invalid incoming slide values and disables movement on request', () => {
    const { container } = render(<DeckPlayer slide={NaN} slides={slides} onSlideChange={vi.fn()}/>);
    expect(container.querySelector('.deck-stage-active')?.textContent).toBe('Content 1');
    fireEvent.click(screen.getByRole('button', { name: 'Приостановить анимацию' }));
    expect(container.querySelector('.sales-deck')?.getAttribute('data-motion')).toBe('off');
  });
});
