import { Link } from 'react-router-dom';
import { Leaf, ShieldCheck } from 'lucide-react';
export default function Header({ admin = false }) {
  return <header className="site-header"><Link to="/" className="brand"><span className="brand-mark"><Leaf size={22}/></span><span><strong>CAN GROUP</strong><small>IMPRESSÃO 3D · PERSONALIZADOS</small></span></Link><nav>{admin ? <Link className="text-link" to="/">Ver catálogo ↗</Link> : <Link className="admin-link" to="/admin/login"><ShieldCheck size={15}/> Área administrativa</Link>}</nav></header>;
}
