import { useEffect, useState } from 'react';
import { RunsListView } from './views/RunsListView';
import { RunDetailView } from './views/RunDetailView';
import { CollectionHealthView } from './views/CollectionHealthView';
import { Tabs } from './components/Tabs';
import type { TabDef } from './components/Tabs';
import { disco, useSequence } from './fun';

const TABS: TabDef[] = [
  { value: 'runs', label: 'Backup Runs' },
  { value: 'health', label: 'Collection Health' },
];

// The current view lives in the URL hash (#/run/{runId}, #/health) so a reload (Ctrl-R) keeps you on the
// same panel, and browser back/forward work too.
type Route = { view: 'runs' } | { view: 'health' } | { view: 'run'; runId: string };

function readRoute(): Route {
  const runMatch = window.location.hash.match(/^#\/run\/(.+)$/);
  if (runMatch) return { view: 'run', runId: decodeURIComponent(runMatch[1]) };
  if (window.location.hash === '#/health') return { view: 'health' };
  return { view: 'runs' };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => readRoute());
  useSequence(disco);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // The hashchange listener would catch these too, but only after a paint — set the state directly so
  // navigation feels immediate.
  const go = (hash: string, next: Route) => {
    window.location.hash = hash;
    setRoute(next);
  };

  // Rendered by the list views themselves, directly under their header — run detail has no tabs, it has
  // a back button.
  const tabs = (
    <Tabs
      tabs={TABS}
      active={route.view}
      onSelect={(value) => (value === 'health' ? go('#/health', { view: 'health' }) : go('#/', { view: 'runs' }))}
    />
  );

  return (
    <div className="page">
      <div className="shell">
        {route.view === 'run' ? (
          <RunDetailView runId={route.runId} onBack={() => go('#/', { view: 'runs' })} />
        ) : route.view === 'health' ? (
          <CollectionHealthView tabs={tabs} />
        ) : (
          <RunsListView
            tabs={tabs}
            onOpen={(runId) => go(`#/run/${encodeURIComponent(runId)}`, { view: 'run', runId })}
          />
        )}
      </div>
    </div>
  );
}
