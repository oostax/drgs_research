import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DashboardHeader } from './DashboardHeader';
import { defaults } from './model';
afterEach(cleanup);
describe('Общий хедер', () => {
  it('сохраняет фильтры в ссылках и переключает разделы презентации', () => {
    const change = vi.fn();
    render(<DashboardHeader c={{ ...defaults, page: 'map', branch: '8610', metric: 'complexShare', group: 'pilot' }} change={change} />);
    const nav = screen.getByRole('navigation', { name: 'Разделы презентации' });
    expect(within(nav).getByRole('link', { name: 'Модель продаж' }).getAttribute('aria-current')).toBe('page');
    const link = within(nav).getByRole('link', { name: 'Глубокое понимание клиента' });
    expect(link.getAttribute('href')).toContain('branch=8610');
    expect(link.getAttribute('href')).toContain('metric=complexShare');
    fireEvent.click(link);
    expect(change).toHaveBeenCalledWith({ section: 'strategy', slide: 1 });
    change.mockClear();
    fireEvent.click(link, { ctrlKey: true });
    expect(change).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Данные и методика' })).toBeNull();
  });
  it('показывает подразделы только для модели продаж', () => {
    const { rerender } = render(<DashboardHeader c={defaults} change={vi.fn()} />);
    expect(screen.getByRole('navigation', { name: 'Разделы модели продаж' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Результаты' }).getAttribute('aria-current')).toBe('page');
    rerender(<DashboardHeader c={{ ...defaults, section: 'academy' }} change={vi.fn()} />);
    expect(screen.queryByRole('navigation', { name: 'Разделы модели продаж' })).toBeNull();
  });
});
