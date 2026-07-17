import {
  FormEvent,
  useState,
} from "react";

import logoUtamed from "./assets/logo-utamed.png";
import {
  authenticateLocally,
  LocalSession,
} from "./auth";

type LoginPageProps = {
  onAuthenticated: (
    session: LocalSession,
  ) => void;
};

function LoginPage({
  onAuthenticated,
}: LoginPageProps) {
  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState<string | null>(null);

  const [submitting, setSubmitting] =
    useState(false);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      const session = authenticateLocally(
        username,
        password,
      );

      if (!session) {
        setError(
          "El usuario o la contraseña no son correctos.",
        );
        return;
      }

      onAuthenticated(session);
    } catch (authenticationError) {
      setError(
        authenticationError instanceof Error
          ? authenticationError.message
          : "No se pudo iniciar sesión.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-presentation">
        <div className="institution-logo-panel">
          <img
            src={logoUtamed}
            alt="UTAMED Universidad"
            className="login-logo"
          />
        </div>

        <div className="login-project-copy">
          <span className="login-eyebrow">
            Trabajo Fin de Máster
          </span>

          <h1 className="login-project-title">
            <span className="title-main-line">
              Desarrollo de un sistema
            </span>

            <span className="title-rag-line">
              <strong>RAG</strong>

              <small>
                (Retrieval-Augmented Generation)
              </small>
            </span>

            <span className="title-main-line">
              para asistencia documental
            </span>

            <span className="title-main-line">
              en entornos corporativos
            </span>
          </h1>

          <div className="academic-data">
            <div>
              <span>Titulación</span>

              <strong>
                Máster en Inteligencia Artificial
              </strong>
            </div>

            <div>
              <span>Autor</span>

              <strong>
                Jesús Ángel Galindo García
              </strong>
            </div>

            <div>
              <span>Universidad</span>

              <strong>
                UTAMED Universidad
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="login-access">
        <div className="login-card">
          <div className="login-card-heading">
            <span className="login-card-kicker">
              Acceso a la plataforma
            </span>

            <h2>Iniciar sesión</h2>

            <p>
              Introduce tus credenciales para
              acceder al laboratorio experimental
              de evaluación RAG.
            </p>
          </div>

          <form
            className="login-form"
            onSubmit={handleSubmit}
          >
            <label>
              Usuario

              <input
                type="text"
                value={username}
                autoComplete="username"
                required
                autoFocus
                onChange={(event) =>
                  setUsername(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Contraseña

              <input
                type="password"
                value={password}
                autoComplete="current-password"
                required
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
              />
            </label>

            {error && (
              <div
                className="login-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={submitting}
            >
              {submitting
                ? "Validando…"
                : "Iniciar sesión"}
            </button>
          </form>

          <p className="local-login-warning">
            Acceso local habilitado para el
            entorno de demostración del TFM.
          </p>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
