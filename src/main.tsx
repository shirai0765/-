import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/manrope';
import '@fontsource-variable/noto-sans-jp';
import './styles.css';
import './ui/immersive-game.css';
import './ui/city-burst-theme.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
