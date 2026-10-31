import { Link } from "react-router-dom";
import companyLogo from "../assets/can-logo-outline.svg";
export default function Header({ admin = false }) {
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <img className="brand-logo" src={companyLogo} alt="CAN Group" />
        <span>
          <strong>CAN GROUP</strong>
          <small>IMPRESSÃO 3D · PERSONALIZADOS</small>
        </span>
      </Link>
      <nav>
        {admin && (
          <Link className="text-link" to="/">
            Ver catálogo ↗
          </Link>
        )}
      </nav>
    </header>
  );
}
