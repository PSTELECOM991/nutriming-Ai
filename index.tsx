import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill for process.env which is required by some SDKs but missing in browser environments
// Fix: Use 'any' cast to access 'process' property on window to avoid TypeScript compilation errors
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
    rootElement.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>Application Error</h1>
      <p>Please check the console for details. This is likely due to a configuration issue.</p>
    </div>`;
  }
}