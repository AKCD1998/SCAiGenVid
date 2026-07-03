import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import StatusBadge, { isTerminalStatus } from "./StatusBadge.jsx";

const POLL_INTERVAL_MS = 15000;

function formatCost(cost) {
  if (cost === null || cost === undefined) return "N/A";
  return `$${Number(cost).toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function JobHistoryList({ selectedJobId, onSelectJob }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [sku, setSku] = useState("");
  const [promptKeyword, setPromptKeyword] = useState("");
  const jobsRef = useRef([]);

  useEffect(() => {
    let isMounted = true;
    let intervalId = null;

    async function loadJobs() {
      try {
        const data = await api.listVideoJobs({
          status: statusFilter,
          dateFrom,
          dateTo,
          createdBy,
          sku,
          promptKeyword,
        });
        if (!isMounted) return;
        const nextJobs = data.jobs || data.items || [];
        jobsRef.current = nextJobs;
        setJobs(nextJobs);
        setError("");
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError.message || "โหลดรายการงานไม่สำเร็จ");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadJobs();

    intervalId = setInterval(() => {
      const hasNonTerminal = jobsRef.current.some((job) => !isTerminalStatus(job.status));
      if (hasNonTerminal) {
        loadJobs();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [statusFilter, dateFrom, dateTo, createdBy, sku, promptKeyword]);

  return (
    <section className="panel">
      <div className="panel-header stacked">
        <h2>ประวัติงานทั้งหมด</h2>
      </div>

      <div className="toolbar">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="draft">ร่าง</option>
          <option value="queued">รอคิว</option>
          <option value="processing">กำลังสร้าง</option>
          <option value="completed">เสร็จสิ้น</option>
          <option value="failed">ล้มเหลว</option>
          <option value="cancelled">ยกเลิก</option>
          <option value="approved">อนุมัติแล้ว</option>
          <option value="rejected">ปฏิเสธแล้ว</option>
        </select>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <input
          placeholder="ผู้สร้างงาน"
          value={createdBy}
          onChange={(event) => setCreatedBy(event.target.value)}
        />
        <input placeholder="SKU" value={sku} onChange={(event) => setSku(event.target.value)} />
        <input
          placeholder="ค้นหาใน prompt"
          value={promptKeyword}
          onChange={(event) => setPromptKeyword(event.target.value)}
        />
      </div>

      {error ? <p className="message error-text">{error}</p> : null}

      {loading ? (
        <p className="subtle">กำลังโหลด...</p>
      ) : jobs.length === 0 ? (
        <p className="empty-state">ยังไม่มีงานในตัวกรองนี้</p>
      ) : (
        <div className="table-shell">
          <table className="job-history-table">
            <thead>
              <tr>
                <th>ตัวอย่าง</th>
                <th>Job ID</th>
                <th>SKU</th>
                <th>ผู้สร้าง</th>
                <th>Provider/Model</th>
                <th>สถานะ</th>
                <th>สร้างเมื่อ</th>
                <th>เสร็จเมื่อ</th>
                <th>การอนุมัติ</th>
                <th>ค่าใช้จ่าย</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.jobId || job.id}
                  className={selectedJobId === (job.jobId || job.id) ? "selected-row" : ""}
                  onClick={() => onSelectJob?.(job.jobId || job.id)}
                >
                  <td>
                    {job.outputAssetId ? (
                      <span className="thumb-placeholder">🎬</span>
                    ) : (
                      <span className="thumb-placeholder muted">–</span>
                    )}
                  </td>
                  <td>{job.jobPublicId || job.jobId || job.id}</td>
                  <td>{job.productIdOrSkuReference || "-"}</td>
                  <td>{job.createdBy || "-"}</td>
                  <td>
                    {job.provider}/{job.model}
                  </td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td>{formatDateTime(job.createdAt)}</td>
                  <td>{formatDateTime(job.completedAt)}</td>
                  <td>{job.approvedAt ? "อนุมัติแล้ว" : job.rejectedAt ? "ปฏิเสธแล้ว" : "-"}</td>
                  <td>{formatCost(job.actualCost ?? job.estimatedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
