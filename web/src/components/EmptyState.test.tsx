import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { LoadingRegion } from './LoadingSkeleton';

describe('EmptyState', () => {
  it('renders title, description and link CTA', () => {
    render(
      <MemoryRouter>
        <EmptyState
          icon={Inbox}
          title="Nothing"
          description="Desc"
          action={{ label: 'Go', to: '/x' }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Nothing');
    expect(screen.getByText('Desc')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/x');
  });

  it('renders button CTA with onClick', async () => {
    const onClick = vi.fn();
    render(
      <MemoryRouter>
        <EmptyState icon={Inbox} title="Nothing" action={{ label: 'Add', onClick }} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('LoadingRegion', () => {
  it('exposes a busy status with label', () => {
    render(<LoadingRegion label="Loading things…">x</LoadingRegion>);
    const r = screen.getByRole('status');
    expect(r).toHaveAttribute('aria-busy', 'true');
    expect(r).toHaveTextContent('Loading things…');
  });
});
