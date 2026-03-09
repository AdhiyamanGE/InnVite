import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const isTests = new URLSearchParams(window.location.search).has('tests');

// Lazy-load test runner only when ?tests is in URL — keeps prod bundle lean
if (isTests) {
  import('./TestRunner.jsx').then(({ default: TestRunner }) => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode><TestRunner /></React.StrictMode>
    );
  });
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode><App /></React.StrictMode>
  );
}
