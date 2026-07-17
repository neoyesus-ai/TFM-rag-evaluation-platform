import {
  useEffect,
  useState,
} from "react";

import AuthenticatedApp from "./AuthenticatedApp";
import {
  clearLocalSession,
  getLocalSession,
  LocalSession,
} from "./auth";
import InstitutionalFooter from "./InstitutionalFooter";
import InstitutionalHeader from "./InstitutionalHeader";
import LoginPage from "./LoginPage";

function App() {
  const [session, setSession] =
    useState<LocalSession | null>(null);

  const [sessionLoaded, setSessionLoaded] =
    useState(false);

  useEffect(() => {
    setSession(getLocalSession());
    setSessionLoaded(true);
  }, []);

  function handleLogout() {
    clearLocalSession();
    setSession(null);
  }

  if (!sessionLoaded) {
    return (
      <div className="application-loading">
        Cargando plataforma…
      </div>
    );
  }

  if (!session) {
    return (
      <LoginPage
        onAuthenticated={setSession}
      />
    );
  }

  return (
    <div className="authenticated-root">
      <InstitutionalHeader
        session={session}
        onLogout={handleLogout}
      />

      <div className="authenticated-content">
        <AuthenticatedApp />
      </div>

      <InstitutionalFooter />
    </div>
  );
}

export default App;
