"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

const MAX_RETRIES = 2;

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[ChunkErrorBoundary]", error.name, error.message, error.stack);

    const isChunkError =
      error.name === "ChunkLoadError" ||
      error.message?.includes("Loading chunk") ||
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("dynamically imported module");

    if (isChunkError && this.state.retryCount < MAX_RETRIES) {
      this.setState(
        (prev) => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }),
        () => {
          if (this.props.onRetry) {
            this.props.onRetry();
          }
        }
      );
    }
  }

  handleManualRetry = () => {
    // Reset retryCount to 0 and clear error so the key changes,
    // forcing a fresh lazy component mount with a new chunk load attempt.
    this.setState({ hasError: false, error: null, retryCount: 0 }, () => {
      if (this.props.onRetry) {
        this.props.onRetry();
      }
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="py-24 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            Algo correu mal ao carregar esta secção.
          </p>
          <button
            type="button"
            onClick={this.handleManualRetry}
            className="mt-3 glass-btn px-4 py-2 text-sm"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    // Use key=retryCount to force a full unmount/remount of children on each retry.
    // React.lazy caches rejected promises — changing the key forces React to throw
    // away the old lazy-component instance and create a fresh one, which triggers a
    // new chunk load attempt.
    return <div key={this.state.retryCount}>{this.props.children}</div>;
  }
}
