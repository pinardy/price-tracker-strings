import { useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { api, IS_STATIC } from './api';
import { FetchStatusBar } from './components/FetchStatusBar';
import { Dashboard } from './pages/Dashboard';
import { ProductDetail } from './pages/ProductDetail';
import { AddProduct } from './pages/AddProduct';
import { Alerts } from './pages/Alerts';

export default function App() {
  const [alertCount, setAlertCount] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  const refreshAlertCount = useCallback(() => {
    api.alerts(true).then((alerts) => setAlertCount(alerts.length)).catch(() => {});
  }, []);

  // Bumped whenever a fetch run finishes so pages reload their data.
  const onDataChanged = useCallback(() => {
    setDataVersion((v) => v + 1);
    refreshAlertCount();
  }, [refreshAlertCount]);

  useEffect(refreshAlertCount, [refreshAlertCount]);

  return (
    <>
      <header className="app-header">
        <span className="brand">🎻 String Price Tracker</span>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          {!IS_STATIC && <NavLink to="/add">Add Product</NavLink>}
          <NavLink to="/alerts">
            Alerts
            {alertCount > 0 && <span className="badge">{alertCount}</span>}
          </NavLink>
        </nav>
        <FetchStatusBar onRunFinished={onDataChanged} />
      </header>
      {IS_STATIC && (
        <div className="static-banner">
          Read-only snapshot — prices update daily via GitHub Actions.
        </div>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Dashboard dataVersion={dataVersion} />} />
          <Route path="/products/:id" element={<ProductDetail dataVersion={dataVersion} />} />
          {!IS_STATIC && <Route path="/add" element={<AddProduct />} />}
          <Route path="/alerts" element={<Alerts onChanged={refreshAlertCount} />} />
        </Routes>
      </main>
    </>
  );
}
