type ComingSoonViewProps = {
  eyebrow: string;
  title: string;
  description: string;
  plannedFeatures: string[];
};

function ComingSoonView({
  eyebrow,
  title,
  description,
  plannedFeatures,
}: ComingSoonViewProps) {
  return (
    <section className="coming-soon-view">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            {eyebrow}
          </span>

          <h1>{title}</h1>

          <p>{description}</p>
        </div>
      </header>

      <article className="panel coming-soon-panel">
        <div className="coming-soon-panel-mark">
          En construcción
        </div>

        <h2>
          Próximo módulo de la plataforma
        </h2>

        <p>
          Esta sección ya forma parte de la
          arquitectura de navegación y se
          completará sobre la capa Analytics
          existente.
        </p>

        <div className="coming-soon-feature-grid">
          {plannedFeatures.map(
            (feature) => (
              <div key={feature}>
                <span>✓</span>
                <strong>
                  {feature}
                </strong>
              </div>
            ),
          )}
        </div>
      </article>
    </section>
  );
}

export default ComingSoonView;
