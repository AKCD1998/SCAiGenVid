import { useState } from "react";
import JobHistoryList from "../components/JobHistoryList.jsx";
import JobDetailPanel from "../components/JobDetailPanel.jsx";
import Modal from "../components/Modal.jsx";

export default function HistoryPage() {
  const [selectedJobId, setSelectedJobId] = useState(null);

  return (
    <div className="history-layout">
      <JobHistoryList selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
      {selectedJobId ? (
        <Modal onClose={() => setSelectedJobId(null)}>
          <JobDetailPanel jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
        </Modal>
      ) : null}
    </div>
  );
}
