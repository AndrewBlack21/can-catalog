import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CatalogPage from '../features/catalog/CatalogPage.jsx';
import ProductPage from '../features/catalog/ProductPage.jsx';
import LoginPage from '../features/admin/LoginPage.jsx';
import DashboardPage from '../features/admin/DashboardPage.jsx';
import PrintCostPage from '../features/admin/PrintCostPage.jsx';

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 320);
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateVisibility);
  }, []);

  if (!visible) return null;

  return (
    <button
      className="back-to-top"
      type="button"
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/produto/:slug" element={<ProductPage />} />
        <Route path="/adm" element={<LoginPage />} />
        <Route path="/adm/painel" element={<DashboardPage />} />
        <Route path="/adm/orcamento-3d" element={<PrintCostPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BackToTop />
    </>
  );
}
