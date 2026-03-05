import { useState, useEffect } from "react";
import axiosInstance from "./api";

const FileVisualization = ({ fileId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVisualizationData = async () => {
      try {
        console.log(`📊 Fetching visualization data for file: ${fileId}`);
        const response = await axiosInstance.get(`/files/${fileId}/visualization`);

        setData(response.data.data);
        console.log("✓ Visualization data loaded");
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load visualization");
        console.error("Visualization error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (fileId) {
      fetchVisualizationData();
    }
  }, [fileId]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loader}>Loading visualization...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  const renderVisualization = () => {
    const { vizType, rows, columns, stats } = data;

    // For now, render a table visualization
    // Complex visualizations would use Plotly, D3.js, or Streamlit

    return (
      <div style={styles.vizContainer}>
        <h3>📊 {vizType.toUpperCase()} Visualization</h3>

        {vizType === "table" && (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row, idx) => (
                  <tr key={idx}>
                    {columns.map((col) => (
                      <td key={col}>{row[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={styles.stats}>
          <h4>📈 Statistics:</h4>
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} style={styles.statItem}>
              <strong>{key}:</strong> {JSON.stringify(value, null, 2)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
        {renderVisualization()}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "20px",
    textAlign: "center",
    color: "white",
  },
  loader: {
    fontSize: "16px",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  error: {
    background: "rgba(255, 100, 100, 0.1)",
    color: "#ff9999",
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid rgba(255, 100, 100, 0.3)",
  },
  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    background: "#020c1b",
    border: "1px solid rgba(0, 229, 255, 0.2)",
    borderRadius: "12px",
    padding: "24px",
    maxWidth: "90%",
    maxHeight: "80vh",
    overflowY: "auto",
    position: "relative",
    color: "white",
  },
  closeBtn: {
    position: "absolute",
    top: "12px",
    right: "12px",
    background: "transparent",
    border: "none",
    color: "#00e5ff",
    fontSize: "24px",
    cursor: "pointer",
  },
  vizContainer: {
    marginTop: "20px",
  },
  tableWrapper: {
    overflowX: "auto",
    marginTop: "16px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    color: "white",
    fontSize: "12px",
  },
  stats: {
    marginTop: "24px",
    padding: "16px",
    background: "rgba(0, 229, 255, 0.05)",
    borderRadius: "8px",
    border: "1px solid rgba(0, 229, 255, 0.1)",
  },
  statItem: {
    marginBottom: "12px",
    padding: "8px",
    background: "rgba(0, 229, 255, 0.08)",
    borderRadius: "4px",
    fontSize: "12px",
  },
};

export default FileVisualization;