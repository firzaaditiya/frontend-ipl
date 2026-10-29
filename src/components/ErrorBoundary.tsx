import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[UI] Unhandled render error', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Terjadi kesalahan / Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Muat ulang halaman. Jika masalah berlanjut, periksa konsol browser.
            <br />
            Reload the page. If the problem persists, check the browser console.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
          >
            Muat ulang / Reload
          </button>
        </div>
      </div>
    );
  }
}
