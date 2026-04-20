import { Component, type ReactNode } from 'react';

interface AIResultsBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface AIResultsBoundaryState {
  hasError: boolean;
}

export class AIResultsBoundary extends Component<AIResultsBoundaryProps, AIResultsBoundaryState> {
  state: AIResultsBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AIResultsBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('AI results rendering error:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
