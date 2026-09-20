import './config/api.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import DashboardExpensePieChart from './components/DashboardExpensePieChart.tsx';
import './index.css';

function renderApp() {
  const analyticsContainer = document.getElementById('bklit-analytics-chart-root') || document.getElementById('root');
  if (analyticsContainer && !(analyticsContainer as any)._reactRoot) {
    const root = createRoot(analyticsContainer);
    (analyticsContainer as any)._reactRoot = root;
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }

  const pieContainer = document.getElementById('dashboard-pie-chart-root');
  if (pieContainer && !(pieContainer as any)._reactRoot) {
    const root = createRoot(pieContainer);
    (pieContainer as any)._reactRoot = root;
    root.render(
      <StrictMode>
        <DashboardExpensePieChart />
      </StrictMode>
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}

// Ensure rendering even if script execution order varies
setTimeout(renderApp, 100);
setTimeout(renderApp, 500);
