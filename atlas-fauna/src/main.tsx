import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'
import { AppProvider } from './contexts/AppContext.tsx'

createRoot(document.getElementById('root')!).render(
  <AppProvider>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </AppProvider>,
)
