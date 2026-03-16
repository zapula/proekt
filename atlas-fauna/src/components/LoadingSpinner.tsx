interface LoadingSpinnerProps {
  label?: string;
}

export function LoadingSpinner({ label = 'Загрузка...' }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner" role="status" aria-live="polite">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}
