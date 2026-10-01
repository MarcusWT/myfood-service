import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="mx-auto max-w-md space-y-3 p-8 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p>An unexpected error occurred.</p>
        <button className="underline" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </main>
    );
  }
}
