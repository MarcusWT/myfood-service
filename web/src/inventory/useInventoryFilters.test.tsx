import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useInventoryFilters } from './useInventoryFilters';

function setup(initial: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ f: useInventoryFilters(), nav: useNavigate(), loc: useLocation() }), {
    wrapper,
  });
}

afterEach(() => vi.useRealTimers());

describe('useInventoryFilters search sync', () => {
  it('does not overwrite newer typing when the URL echo of an older value arrives', () => {
    vi.useFakeTimers();
    const { result } = setup('/');
    act(() => result.current.f.setSearch('ab'));
    act(() => {
      vi.advanceTimersByTime(300);
      result.current.f.setSearch('abc');
    });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.loc.search).toBe('?name=ab');
    expect(result.current.f.search).toBe('abc');
  });

  it('syncs the input on back/forward and external changes', () => {
    const { result } = setup('/?name=a');
    expect(result.current.f.search).toBe('a');
    act(() => result.current.nav('/?name=b'));
    expect(result.current.f.search).toBe('b');
    act(() => result.current.nav(-1));
    expect(result.current.f.search).toBe('a');
  });

  it('clear() empties the input', () => {
    const { result } = setup('/?name=a');
    act(() => result.current.f.clear());
    expect(result.current.f.search).toBe('');
    expect(result.current.loc.search).toBe('');
  });
});
