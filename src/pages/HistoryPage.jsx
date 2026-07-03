import { useState } from "react";
import JobHistoryList from "../components/JobHistoryList.jsx";
import JobDetailPanel from "../components/JobDetailPanel.jsx";

export default function HistoryPage() {
  const [selectedJobId, setSelectedJobId] = useState(null);

  return (
    <div className="history-layout">
      <JobHistoryList selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
      {selectedJobId ? (
        <JobDetailPanel jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      ) : null}
    </div>
  );
}
