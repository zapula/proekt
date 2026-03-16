import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Ошибка интерфейса:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-fallback" role="alert">
          <h2>Что-то пошло не так</h2>
          <p>Произошла непредвиденная ошибка интерфейса.</p>
          <button onClick={() => window.location.reload()}>Перезагрузить страницу</button>
        </div>
      );
    }

    return this.props.children;
  }
}
