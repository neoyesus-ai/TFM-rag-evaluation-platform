import type {
  AppView,
} from "../../types/navigation";
import {
  NAVIGATION_GROUPS,
} from "../../types/navigation";

type AppSidebarProps = {
  activeView: AppView;
  systemStatus: string | null;
  onNavigate: (
    view: AppView,
  ) => void;
};

function AppSidebar({
  activeView,
  systemStatus,
  onNavigate,
}: AppSidebarProps) {
  const isOperational =
    systemStatus === "ok";

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-brand">
        <div className="app-sidebar-brand-mark">
          R
        </div>

        <div>
          <strong>RAG Lab</strong>

          <span>
            Experimental Platform
          </span>
        </div>
      </div>

      <nav
        className="app-sidebar-navigation"
        aria-label="Navegación principal"
      >
        {NAVIGATION_GROUPS.map(
          (group) => (
            <section
              className="app-navigation-group"
              key={group.label}
            >
              <span className="app-navigation-group-label">
                {group.label}
              </span>

              <div className="app-navigation-items">
                {group.items.map(
                  (item) => {
                    const isActive =
                      activeView ===
                      item.view;

                    return (
                      <button
                        type="button"
                        className={[
                          "app-navigation-item",
                          isActive
                            ? "app-navigation-item-active"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={item.view}
                        onClick={() =>
                          onNavigate(
                            item.view,
                          )
                        }
                      >
                        <span className="app-navigation-icon">
                          {item.icon}
                        </span>

                        <span className="app-navigation-copy">
                          <strong>
                            {item.label}
                          </strong>

                          <small>
                            {
                              item.description
                            }
                          </small>
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </section>
          ),
        )}
      </nav>

      <div className="app-sidebar-status">
        <span
          className={[
            "app-system-indicator",
            isOperational
              ? "app-system-indicator-online"
              : "",
          ].join(" ")}
        />

        <div>
          <strong>
            {isOperational
              ? "Sistema operativo"
              : "Estado no disponible"}
          </strong>

          <span>
            Infraestructura experimental
          </span>
        </div>
      </div>
    </aside>
  );
}

export default AppSidebar;
