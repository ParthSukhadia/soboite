import React from 'react';

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.error('Unhandled error caught by ErrorBoundary:', error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
    // For HashRouter apps, navigate home to recover from broken routes
    try {
      if (typeof window !== 'undefined') {
        window.location.hash = '#/';
      }
    } catch (e) {
      // ignore
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-center text-gray-700">
          <h2 className="text-lg font-semibold mb-2">Something went wrong.</h2>
          <p className="text-sm mb-4">An unexpected error occurred while loading this view.</p>
          <div className="flex justify-center gap-2">
            <button onClick={this.handleReset} className="px-4 py-2 rounded bg-blue-600 text-white">Go Home</button>
            <button onClick={() => window.location.reload()} className="px-4 py-2 rounded border">Reload</button>
          </div>
          <details className="mt-4 text-left text-xs text-gray-500 p-2 rounded border">
            <summary>Show error</summary>
            <pre className="whitespace-pre-wrap">{String(this.state.error && this.state.error.stack)}</pre>
          </details>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
