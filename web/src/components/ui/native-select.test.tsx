import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NativeSelect } from './native-select';

describe('NativeSelect', () => {
  it('renders a native select with options and forwards props', async () => {
    const onChange = vi.fn();
    render(
      <NativeSelect aria-label="Unit" aria-invalid className="h-9" onChange={onChange}>
        <option value="a">A</option>
        <option value="b">B</option>
      </NativeSelect>,
    );
    const select = screen.getByRole('combobox', { name: 'Unit' });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveClass('h-9');
    await userEvent.selectOptions(select, 'b');
    expect(onChange).toHaveBeenCalled();
    expect(select).toHaveValue('b');
  });

  it('hides the chevron from assistive tech and supports disabled', () => {
    const { container } = render(
      <NativeSelect aria-label="X" disabled>
        <option>1</option>
      </NativeSelect>,
    );
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
