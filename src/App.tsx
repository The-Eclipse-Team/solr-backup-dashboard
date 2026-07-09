import { useEffect, useState } from 'react';
import { RunsListView } from './views/RunsListView';
import { RunDetailView } from './views/RunDetailView';

// The selected run lives in the URL hash (#/run/{runId}) so a reload (Ctrl-R) keeps you on the same
// panel, and browser back/forward work too.
function readRunIdFromHash(): string | null {
  const match = window.location.hash.match(/^#\/run\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function App() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(() => readRunIdFromHash());

  useEffect(() => {
    const onHashChange = () => setSelectedRunId(readRunIdFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const openRun = (runId: string) => {
    window.location.hash = `#/run/${encodeURIComponent(runId)}`;
    setSelectedRunId(runId);
  };

  const backToList = () => {
    window.location.hash = '#/';
    setSelectedRunId(null);
  };

  return (
    <div className="page">
      <div className="shell">
        {selectedRunId ? (
          <RunDetailView runId={selectedRunId} onBack={backToList} />
        ) : (
          <RunsListView onOpen={openRun} />
        )}
      </div>
    </div>
  );
}
