type KPICardProps = {
  label: string;
  value: string;
  description: string;
  emphasis?: "default" | "primary" | "success" | "warning";
};

function KPICard({
  label,
  value,
  description,
  emphasis = "default",
}: KPICardProps) {
  return (
    <article
      className={[
        "analytics-kpi-card",
        `analytics-kpi-${emphasis}`,
      ].join(" ")}
    >
      <span className="analytics-kpi-label">
        {label}
      </span>

      <strong className="analytics-kpi-value">
        {value}
      </strong>

      <small className="analytics-kpi-description">
        {description}
      </small>
    </article>
  );
}

export default KPICard;
