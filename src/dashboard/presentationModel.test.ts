import { describe, expect, it } from 'vitest';
import { defaults, parseContext } from './model';
import { adjacentSection, normalizeSlide, presentationFlow, swipeDirection, transitionKind } from './presentationModel';

describe('Presentation routing', () => {
  it.each([['x', 1], [NaN, 1], [Infinity, 1], [-3, 1], [0, 1], [2.7, 2], [900, 9], ['5', 5], [null, 1]])('normalizes slide %s to %s', (value, expected) => {
    expect(normalizeSlide(value)).toBe(expected);
    expect(parseContext(`?slide=${value}`).slide).toBe(expected);
  });
  it('visits every section and subsection forward and backward without looping', () => {
    for (let i = 0; i < presentationFlow.length; i++) {
      const stop = presentationFlow[i];
      const c = { ...defaults, ...stop, branch: '8610', group: 'pilot' as const, quarter: 2 };
      for (const direction of [-1, 1] as const) {
        const next = adjacentSection(c, direction), expected = presentationFlow[i + direction];
        if (!expected) { expect(next).toBeNull(); continue; }
        expect(next?.patch.section).toBe(expected.section);
        if (expected.modelView) expect(next?.patch.modelView).toBe(expected.modelView);
        expect(next?.patch.page).toBe('overview');
        expect({ ...c, ...next?.patch }).toMatchObject({ branch: '8610', group: 'pilot', quarter: 2 });
      }
    }
  });
  it('returns from results to the final premises slide', () => {
    expect(adjacentSection(defaults, -1)?.patch).toMatchObject({ modelView: 'premises', slide: 9 });
  });
  it.each([[2,3,'grid-wipe'], [3,4,'iris-wipe'], [4,5,'pyramid-zoom'], [5,6,'role-stack'], [6,7,'collaboration'], [7,8,'radar-scan'], [5,4,'standard'], [1,9,'standard']])('chooses the transition from %s to %s', (from,to,kind) => {
    expect(transitionKind(Number(from), Number(to))).toBe(kind);
  });
});
describe('Intentional swipes', () => {
  it.each([[-100,8,250,1], [100,8,250,-1], [20,0,100,0], [60,80,300,0], [100,0,1400,0], [0,100,200,0]])('%s / %s in %s ms => %s', (dx,dy,ms,expected) => {
    expect(swipeDirection(dx,dy,ms)).toBe(expected);
  });
});
