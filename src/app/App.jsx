import { Navigate, Route, Routes } from 'react-router-dom';
import CatalogPage from '../features/catalog/CatalogPage.jsx';
import ProductPage from '../features/catalog/ProductPage.jsx';
import LoginPage from '../features/admin/LoginPage.jsx';
import DashboardPage from '../features/admin/DashboardPage.jsx';
export default function App(){return <Routes><Route path="/" element={<CatalogPage/>}/><Route path="/produto/:slug" element={<ProductPage/>}/><Route path="/admin/login" element={<LoginPage/>}/><Route path="/admin" element={<DashboardPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
