import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/app/App';
import { applyUiPrefs, getUiPrefs } from '@/utils/uiPrefs';

import '@/styles/tokens.css';
import '@/styles/reset.css';
import '@/styles/typography.css';
import '@/styles/global.css';

// 启动时应用本机界面偏好（密度 / 主题色）。
applyUiPrefs(getUiPrefs());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);