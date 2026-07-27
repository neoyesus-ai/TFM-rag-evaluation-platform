export type AppView =
  | "dashboard"
  | "corpora"
  | "datasets"
  | "experiments"
  | "runs"
  | "rag-console"
  | "analytics"
  | "comparator"
  | "leaderboard"
  | "insights"
  | "recommendations"
  | "services";

export type NavigationItem = {
  view: AppView;
  label: string;
  description: string;
  icon: string;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    label: "Inicio",
    items: [
      {
        view: "dashboard",
        label: "Panel general",
        description:
          "Resumen operativo de la plataforma",
        icon: "PG",
      },
    ],
  },
  {
    label: "Gestión",
    items: [
      {
        view: "corpora",
        label: "Corpora y documentos",
        description:
          "Colecciones y documentación",
        icon: "CD",
      },
      {
        view: "datasets",
        label: "Datasets",
        description:
          "Conjuntos de evaluación",
        icon: "DS",
      },
      {
        view: "experiments",
        label: "Experimentos",
        description:
          "Configuraciones experimentales",
        icon: "EX",
      },
      {
        view: "runs",
        label: "Ejecuciones",
        description:
          "Histórico de runs",
        icon: "RN",
      },
      {
        view: "rag-console",
        label: "Consola RAG",
        description:
          "Consultas interactivas",
        icon: "RG",
      },
    ],
  },
  {
    label: "Análisis",
    items: [
      {
        view: "analytics",
        label: "Resultados",
        description:
          "Métricas y rendimiento RAG",
        icon: "RS",
      },
      {
        view: "comparator",
        label: "Comparador",
        description:
          "Comparación entre ejecuciones",
        icon: "CP",
      },
      {
        view: "leaderboard",
        label: "Leaderboard",
        description:
          "Ranking de configuraciones",
        icon: "LB",
      },
      {
        view: "insights",
        label: "Insights",
        description:
          "Patrones del histórico",
        icon: "IN",
      },
      {
        view: "recommendations",
        label: "Recomendaciones",
        description:
          "Apoyo a la decisión",
        icon: "RC",
      },
    ],
  },
  {
    label: "Plataforma",
    items: [
      {
        view: "services",
        label: "Servicios",
        description:
          "Estado de la infraestructura",
        icon: "SV",
      },
    ],
  },
];
