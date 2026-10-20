import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// Keep the first paint responsive while the engineering catalog loads.
void import('./App')
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error('The part library failed to load.', error);
    root.render(
      <main className="startup-screen" role="alert">
        <strong className="startup-screen__brand">ProtoLab</strong>
        <h1>The library could not be opened.</h1>
        <p>Check your connection and try again. Projects saved in this browser are retained.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>,
    );
  });
