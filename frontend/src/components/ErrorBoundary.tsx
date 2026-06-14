import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React render tree:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="max-w-md w-full bg-surface rounded-[24px] shadow-card border border-border p-8 space-y-6 animate-scale-in">
            <div className="w-16 h-16 bg-status-rejected-bg border border-status-rejected/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-status-rejected animate-bounce" />
            </div>

            <div className="space-y-2">
              <h1 className="text-[20px] font-bold text-text-primary tracking-tight">Something went wrong</h1>
              <p className="text-[13px] text-text-secondary leading-relaxed">
                The application encountered an unexpected runtime error. We've logged the details and you can try refreshing the page.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3.5 rounded-[12px] bg-background-secondary border border-border text-left overflow-auto max-h-32 text-text-secondary font-mono text-[11px] select-text">
                <p className="font-semibold text-status-rejected mb-0.5">{this.state.error.name}: {this.state.error.message}</p>
                <p className="opacity-80 text-[10px] whitespace-pre-wrap">{this.state.error.stack}</p>
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="w-full h-11 rounded-[12px] bg-accent text-accent-foreground text-[14px] font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all duration-fast flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
