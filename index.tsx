
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Polyfill for process.env which is required by some SDKs but missing in browser environments
if (typeof window !== 'undefined' && !(window as any).process) {
  (window as any).process = { env: {} };
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Critical: Could not find root element with id 'root'");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Failed to render the application:", error);
    rootElement.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif; background: white; height: 100vh;">
      <h1>Application Error</h1>
      <p>Please check the browser console for details. Error: ${error instanceof Error ? error.message : String(error)}</p>
    </div>`;
  }
}
