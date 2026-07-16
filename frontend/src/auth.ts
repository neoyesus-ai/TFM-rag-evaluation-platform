const AUTH_STORAGE_KEY = "tfm-rag-local-session";

export type LocalSession = {
  username: string;
  fullName: string;
  authenticatedAt: string;
};

function getConfiguredUsername(): string {
  return (
    import.meta.env.VITE_LOCAL_AUTH_USERNAME?.trim() ||
    "admin"
  );
}

function getConfiguredPassword(): string {
  return (
    import.meta.env.VITE_LOCAL_AUTH_PASSWORD ||
    ""
  );
}

function getConfiguredFullName(): string {
  return (
    import.meta.env.VITE_LOCAL_AUTH_FULL_NAME?.trim() ||
    "Jesús Ángel Galindo García"
  );
}

export function authenticateLocally(
  username: string,
  password: string,
): LocalSession | null {
  const expectedUsername = getConfiguredUsername();
  const expectedPassword = getConfiguredPassword();

  if (!expectedPassword) {
    throw new Error(
      "La contraseña local no está configurada en frontend/.env.local.",
    );
  }

  const validUsername =
    username.trim().toLowerCase() ===
    expectedUsername.toLowerCase();

  const validPassword =
    password === expectedPassword;

  if (!validUsername || !validPassword) {
    return null;
  }

  const session: LocalSession = {
    username: expectedUsername,
    fullName: getConfiguredFullName(),
    authenticatedAt: new Date().toISOString(),
  };

  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify(session),
  );

  return session;
}

export function getLocalSession(): LocalSession | null {
  const rawSession = localStorage.getItem(
    AUTH_STORAGE_KEY,
  );

  if (!rawSession) {
    return null;
  }

  try {
    const session = JSON.parse(
      rawSession,
    ) as LocalSession;

    if (
      !session.username ||
      !session.fullName ||
      !session.authenticatedAt
    ) {
      clearLocalSession();
      return null;
    }

    return session;
  } catch {
    clearLocalSession();
    return null;
  }
}

export function clearLocalSession(): void {
  localStorage.removeItem(
    AUTH_STORAGE_KEY,
  );
}
