import logoUtamed from "./assets/logo-utamed.png";
import { LocalSession } from "./auth";

type InstitutionalHeaderProps = {
  session: LocalSession;
  onLogout: () => void;
};

function InstitutionalHeader({
  session,
  onLogout,
}: InstitutionalHeaderProps) {
  return (
    <header className="institutional-header">
      <div className="institutional-brand">
        <img
          src={logoUtamed}
          alt="UTAMED Universidad"
        />

        <div>
          <span>
            Máster en Inteligencia Artificial
          </span>

          <strong>
            Plataforma experimental de
            evaluación RAG
          </strong>
        </div>
      </div>

      <div className="institutional-user">
        <div>
          <strong>{session.fullName}</strong>
          <span>{session.username}</span>
        </div>

        <button
          type="button"
          onClick={onLogout}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

export default InstitutionalHeader;
