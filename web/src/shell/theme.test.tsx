import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from './useTheme';

type Listener = () => void;
let prefersDark = false;
const mqListeners = new Set<Listener>();

beforeEach(() => {
  prefersDark = false;
  mqListeners.clear();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return prefersDark;
    },
    media: query,
    addEventListener: (_: string, l: Listener) => mqListeners.add(l),
    removeEventListener: (_: string, l: Listener) => mqListeners.delete(l),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  // @ts-expect-error restore jsdom default (no matchMedia)
  delete window.matchMedia;
});

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="state">
        {theme}/{resolvedTheme}
      </span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('system')}>system</button>
    </div>
  );
}

describe('useTheme', () => {
  it('defaults to system and follows matchMedia', () => {
    prefersDark = true;
    render(<Probe />);
    expect(screen.getByTestId('state')).toHaveTextContent('system/dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('persists light, dark and system choices', async () => {
    render(<Probe />);
    await userEvent.click(screen.getByText('dark'));
    expect(localStorage.getItem('myfood.theme')).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    await userEvent.click(screen.getByText('light'));
    expect(localStorage.getItem('myfood.theme')).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
    await userEvent.click(screen.getByText('system'));
    expect(localStorage.getItem('myfood.theme')).toBeNull();
    expect(screen.getByTestId('state')).toHaveTextContent('system/light');
  });

  it('reacts to live matchMedia changes in system mode', () => {
    render(<Probe />);
    expect(screen.getByTestId('state')).toHaveTextContent('system/light');
    prefersDark = true;
    act(() => mqListeners.forEach((l) => l()));
    expect(screen.getByTestId('state')).toHaveTextContent('system/dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('honours a legacy stored dark value and treats invalid as system', () => {
    localStorage.setItem('myfood.theme', 'dark');
    const { unmount } = render(<Probe />);
    expect(screen.getByTestId('state')).toHaveTextContent('dark/dark');
    unmount();
    localStorage.setItem('myfood.theme', 'purple');
    render(<Probe />);
    expect(screen.getByTestId('state')).toHaveTextContent('system/light');
  });

  it('syncs from storage events', () => {
    render(<Probe />);
    localStorage.setItem('myfood.theme', 'dark');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'myfood.theme' }));
    });
    expect(screen.getByTestId('state')).toHaveTextContent('dark/dark');
  });
});

describe('useTheme purity', () => {
  it('reading the snapshot does not touch the DOM', () => {
    const { unmount } = render(<Probe />);
    unmount();
    document.documentElement.classList.remove('dark');
    localStorage.setItem('myfood.theme', 'dark');
    const spy = vi.spyOn(document.documentElement.classList, 'toggle');
    const add = vi.spyOn(document.documentElement.classList, 'add');
    renderHook(() => useTheme());
    spy.mockClear();
    add.mockClear();
    const before = document.documentElement.className;
    const { rerender } = renderHook(() => useTheme());
    rerender();
    expect(document.documentElement.className).toBe(before);
    expect(spy).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    spy.mockRestore();
    add.mockRestore();
  });
});

describe('ThemeToggle', () => {
  it('chooses a theme from the menu', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Theme' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('myfood.theme')).toBe('dark');
  });
});
