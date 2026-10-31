export default function AlertsTable({ alerts, onStatus }) {
  if (!alerts.length) return <p className="muted">No alerts yet. Load demo data or upload a CSV.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Time</th><th>Sensor</th><th>Severity</th><th>Message</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a._id}>
              <td>{new Date(a.ts).toLocaleString()}</td>
              <td>{a.sensor_id}</td>
              <td><span className={`badge ${a.severity}`}>{a.severity}</span></td>
              <td>{a.message}</td>
              <td>{a.status}</td>
              <td className="actions">
                {a.status === "open" && <button onClick={() => onStatus(a._id, "acknowledged")}>Acknowledge</button>}
                {a.status !== "resolved" && <button onClick={() => onStatus(a._id, "resolved")}>Resolve</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
