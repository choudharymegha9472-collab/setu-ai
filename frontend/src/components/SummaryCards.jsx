export default function SummaryCards({ summary }) {
  const items = [
    ["Sensors", summary.sensors],
    ["Readings", summary.readings],
    ["Open alerts", summary.open_alerts],
    ["Critical", summary.critical_open],
  ];
  return (
    <div className="cards">
      {items.map(([label, value]) => (
        <div className="card" key={label}>
          <div className="card-value">{value ?? "–"}</div>
          <div className="card-label">{label}</div>
        </div>
      ))}
    </div>
  );
}
