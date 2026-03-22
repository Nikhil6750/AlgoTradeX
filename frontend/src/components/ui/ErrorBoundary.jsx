// src/components/ErrorBoundary.jsx
import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Render crash:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#000000] p-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[#444444]">Unexpected Error</p>
          <h1 className="text-2xl font-black text-white">Something went wrong</h1>
          <pre className="max-w-lg text-sm text-red-400 whitespace-pre-wrap">{String(this.state.error)}</pre>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = "/dashboard";
            }}
            className="mt-2 rounded-xl border border-[#222222] bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a1a1a]"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
