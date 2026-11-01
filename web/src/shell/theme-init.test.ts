import script from '../../public/theme-init.js?raw';

function run(stored: string | null, prefersDark: boolean) {
  document.head.innerHTML = '<meta id="theme-color" name="theme-color" content="#ffffff">';
  document.documentElement.classList.remove('dark');
  if (stored === null) localStorage.removeItem('myfood.theme');
  else localStorage.setItem('myfood.theme', stored);
  window.matchMedia = (() => ({ matches: prefersDark })) as unknown as typeof window.matchMedia;
  new Function(script)();
  // @ts-expect-error restore jsdom default
  delete window.matchMedia;
}

describe('public/theme-init.js', () => {
  it('applies dark from storage', () => {
    run('dark', false);
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.getElementById('theme-color')).toHaveAttribute('content', '#0a0a0a');
  });

  it('applies light from storage even if the system prefers dark', () => {
    run('light', true);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('falls back to system for missing or invalid values', () => {
    run(null, true);
    expect(document.documentElement).toHaveClass('dark');
    run('bogus', false);
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
