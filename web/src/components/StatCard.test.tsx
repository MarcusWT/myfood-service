import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Package } from 'lucide-react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders a static card', () => {
    render(<StatCard label="Items" value={5} icon={Package} hint="in stock" />);
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('in stock')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('links with an accessible name of label and value', () => {
    const { container } = render(
      <MemoryRouter>
        <StatCard label="Expired" value={2} icon={Package} tone="danger" to="/alerts" />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Expired 2' });
    expect(link).toHaveAttribute('href', '/alerts');
    expect(container.querySelector('[data-interactive]')).not.toBeNull();
    expect(container.querySelector('svg')?.parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});
