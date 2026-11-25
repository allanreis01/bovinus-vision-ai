import { useState, useEffect } from 'react';
import { Layout } from './components/Layout.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { BalancaScanner } from './pages/BalancaScanner.jsx';
import { MonitorFilas } from './pages/MonitorFilas.jsx';
import { RadarSalao } from './pages/RadarSalao.jsx';
import { DesperdicioQualidade } from './pages/DesperdicioQualidade.jsx';
import { api } from './services/api.js';

export function App() {
  const [paginaAtiva, setPaginaAtiva] = useState('dashboard');
  const [visaoStatus, setVisaoStatus] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [resetando, setResetando] = useState(false);

  useEffect(() => {
    let ativo = true;
    api.getHealth().then(
      (res) => {
        if (ativo) setVisaoStatus(res.visao);
      },
      () => {},
    );
    return () => {
      ativo = false;
    };
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleResetDemo = async () => {
    setResetando(true);
    try {
      await api.resetarDemo();
      setRefreshKey((k) => k + 1);
    } finally {
      setResetando(false);
    }
  };

  return (
    <Layout
      paginaAtiva={paginaAtiva}
      onNavegar={setPaginaAtiva}
      visaoStatus={visaoStatus}
      onResetDemo={handleResetDemo}
      onRefresh={handleRefresh}
      resetando={resetando}
    >
      {paginaAtiva === 'dashboard' && <Dashboard refreshKey={refreshKey} onNavegar={setPaginaAtiva} />}
      {paginaAtiva === 'balanca' && <BalancaScanner refreshKey={refreshKey} />}
      {paginaAtiva === 'filas' && <MonitorFilas refreshKey={refreshKey} />}
      {paginaAtiva === 'salao' && <RadarSalao refreshKey={refreshKey} />}
      {paginaAtiva === 'desperdicio' && <DesperdicioQualidade refreshKey={refreshKey} />}
    </Layout>
  );
}

export default App;
