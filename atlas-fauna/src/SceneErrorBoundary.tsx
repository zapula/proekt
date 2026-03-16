import { Component, type ErrorInfo, type ReactNode } from 'react';

interface SceneErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: string;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
}

export default class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ошибка 3D-сцены:', error, info);
  }

  componentDidUpdate(prevProps: SceneErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="scene-placeholder">
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>3D сцена недоступна</div>
            <div style={{ fontSize: 13, color: '#555', textAlign: 'center', maxWidth: 280 }}>
              В этом окружении не удалось инициализировать WebGL.
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
