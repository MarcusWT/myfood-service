import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination, getPageRange } from './Pagination';

describe('getPageRange', () => {
  it('shows all pages when few', () => {
    expect(getPageRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('windows with gaps', () => {
    expect(getPageRange(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap-end', 20]);
    expect(getPageRange(10, 20)).toEqual([1, 'gap-start', 9, 10, 11, 'gap-end', 20]);
    expect(getPageRange(20, 20)).toEqual([1, 'gap-start', 16, 17, 18, 19, 20]);
  });
});

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the current page and navigates', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Page 4' }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: /Previous/ }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('disables Previous on first and Next on last page', () => {
    const { rerender } = render(<Pagination page={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
    rerender(<Pagination page={3} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
  });
});
