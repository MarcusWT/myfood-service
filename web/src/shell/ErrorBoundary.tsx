import { Component, type ErrorInfo, type ReactNode } from 'react';
import { MAIN_CONTENT_ID } from './constants';

interface Props {
  children: ReactNode;
  resetKey?: unknown;
  variant?: 'page' | 'inline';
}

interface State {
  error: Error | null;
}

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Loading chunk/i;

export function isChunkLoadError(error: Error): boolean {
  return CHUNK_ERROR.test(error.message);
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkLoadError(error);
    const inline = this.props.variant === 'inline';
    const Wrapper = inline ? 'div' : 'main';
    return (
      <Wrapper
        role="alert"
        {...(inline ? {} : { id: MAIN_CONTENT_ID, tabIndex: -1 })}
        className="mx-auto max-w-md space-y-3 p-8 text-center outline-none"
      >
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p>{chunk ? 'A new version is available. Reload.' : 'An unexpected error occurred.'}</p>
        <div className="flex justify-center gap-4">
          {!chunk && (
            <button className="underline" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          )}
          <button className="underline" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </Wrapper>
    );
  }
}
