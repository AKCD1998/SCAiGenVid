import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../AuthContext.jsx";
import { can } from "../lib/permissions.js";
import StatusBadge, { isTerminalStatus } from "./StatusBadge.jsx";

const POLL_INTERVAL_MS = 5000;

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

export default function JobDetailPanel({ jobId, onClose }) {
  const { role } = useAuth();
  const [job, setJob] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const [actionError, setActionError] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const jobRef = useRef(null);

  useEffect(() => {
    if (!jobId) return undefined;

    let isMounted = true;
    let intervalId = null;

    async function loadJob() {
      try {
        const data = await api.getVideoJob(jobId);
        if (!isMounted) return;
        const nextJob = data.job || data;
        jobRef.current = nextJob;
        setJob(nextJob);
        setError("");
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError.message || "โหลดรายละเอียดงานไม่สำเร็จ");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    async function loadEvents() {
      try {
        const data = await api.getVideoJobEvents(jobId);
        if (!isMounted) return;
        setEvents(data.events || data.items || []);
      } catch {
        // Event timeline failures are non-fatal; keep whatever was loaded.
      }
    }

    setLoading(true);
    setDownloadUrl("");
    setDownloadError("");
    loadJob();
    loadEvents();

    intervalId = setInterval(() => {
      if (jobRef.current && !isTerminalStatus(jobRef.current.status)) {
        loadJob();
        loadEvents();
      } else if (intervalId) {
        clearInterval(intervalId);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId]);

  async function handleLoadDownloadUrl() {
    setDownloadError("");
    try {
      const data = await api.getVideoJobDownloadUrl(jobId);
      setDownloadUrl(data.url);
    } catch (loadError) {
      setDownloadError(loadError.message || "ดึงลิงก์ดาวน์โหลดไม่สำเร็จ");
    }
  }

  async function runAction(actionFn) {
    setActionError("");
    setBusy(true);
    try {
      const data = await actionFn();
      const nextJob = data.job || data;
      jobRef.current = nextJob;
      setJob(nextJob);
    } catch (actionErrorObj) {
      setActionError(actionErrorObj.message || "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (!jobId) return null;

  if (loading && !job) {
    return (
      <aside className="panel job-detail-panel">
        <p className="subtle">กำลังโหลดรายละเอียดงาน...</p>
      </aside>
    );
  }

  if (error && !job) {
    return (
      <aside className="panel job-detail-panel">
        <p className="message error-text">{error}</p>
        <button type="button" onClick={onClose}>
          ปิด
        </button>
      </aside>
    );
  }

  if (!job) return null;

  const canApprove = can(role, "content.video.approve") && job.status === "completed";
  const canReject = can(role, "content.video.reject") && job.status === "completed";
  const canRetry = can(role, "content.video.retry") && job.status === "failed";
  const canCancel = ["draft", "queued", "processing"].includes(job.status);
  const canDownload =
    can(role, "content.video.download") && ["completed", "approved"].includes(job.status);

  return (
    <aside className="panel job-detail-panel">
      <div className="panel-header">
        <h2>รายละเอียดงาน #{job.jobPublicId || job.jobId}</h2>
        <button type="button" className="ghost" onClick={onClose}>
          ปิด
        </button>
      </div>

      <StatusBadge status={job.status} />

      {job.inputAssetId ? (
        <div className="job-detail-section">
          <h3>รูปภาพต้นฉบับ</h3>
          <p className="subtle">Asset ID: {job.inputAssetId}</p>
        </div>
      ) : null}

      <div className="job-detail-section">
        <h3>Prompt</h3>
        <p>{job.prompt}</p>
        {job.negativePrompt ? (
          <>
            <h3>Negative Prompt</h3>
            <p>{job.negativePrompt}</p>
          </>
        ) : null}
      </div>

      <div className="job-detail-section">
        <h3>การตั้งค่า</h3>
        <p>
          อัตราส่วน: {job.aspectRatio} · ความยาว: {job.durationSeconds}s
          <br />
          Provider/Model: {job.provider}/{job.model}
          <br />
          SKU: {job.productIdOrSkuReference || "-"}
          <br />
          ค่าใช้จ่ายประมาณการ: {formatCost(job.estimatedCost)} · ค่าใช้จ่ายจริง: {formatCost(job.actualCost)}
        </p>
      </div>

      {job.status === "failed" ? (
        <div className="job-detail-section">
          <h3>รายละเอียดข้อผิดพลาด</h3>
          <p className="message error-text">
            {job.errorCode ? `[${job.errorCode}] ` : ""}
            {job.errorMessage || "ไม่มีรายละเอียดเพิ่มเติม"}
          </p>
        </div>
      ) : null}

      {["completed", "approved"].includes(job.status) ? (
        <div className="job-detail-section">
          <h3>วิดีโอผลลัพธ์</h3>
          {downloadUrl ? (
            <>
              <video controls src={downloadUrl} className="job-detail-video" />
              <a className="text-link" href={downloadUrl} target="_blank" rel="noreferrer">
                ดาวน์โหลดวิดีโอ
              </a>
            </>
          ) : canDownload ? (
            <button type="button" onClick={handleLoadDownloadUrl}>
              โหลดลิงก์วิดีโอ
            </button>
          ) : (
            <p className="subtle">คุณไม่มีสิทธิ์ดาวน์โหลดไฟล์นี้</p>
          )}
          {downloadError ? <p className="message error-text">{downloadError}</p> : null}
        </div>
      ) : null}

      <div className="job-detail-section">
        <h3>ไทม์ไลน์เหตุการณ์</h3>
        {events.length === 0 ? (
          <p className="subtle">ยังไม่มีเหตุการณ์</p>
        ) : (
          <ul className="timeline-list">
            {events.map((event, index) => (
              <li key={event.id || index} className="timeline-item">
                <span className="timeline-type">{event.type || event.eventType}</span>
                <span className="subtle">{formatDateTime(event.createdAt)}</span>
                {event.note || event.message ? (
                  <p className="timeline-note">{event.note || event.message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {actionError ? <p className="message error-text">{actionError}</p> : null}

      <div className="job-detail-actions">
        {canApprove ? (
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => {
              if (window.confirm("ยืนยันการอนุมัติวิดีโอนี้หรือไม่?")) {
                runAction(() => api.approveVideoJob(jobId));
              }
            }}
          >
            อนุมัติ
          </button>
        ) : null}

        {canReject ? (
          <div className="reject-controls">
            {showRejectForm ? (
              <>
                <input
                  placeholder="เหตุผลในการปฏิเสธ (จำเป็น)"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !rejectReason.trim()}
                  onClick={() => runAction(() => api.rejectVideoJob(jobId, rejectReason.trim()))}
                >
                  ยืนยันการปฏิเสธ
                </button>
              </>
            ) : (
              <button type="button" className="ghost" onClick={() => setShowRejectForm(true)}>
                ปฏิเสธ
              </button>
            )}
          </div>
        ) : null}

        {canRetry ? (
          <button type="button" disabled={busy} onClick={() => runAction(() => api.retryVideoJob(jobId))}>
            ลองใหม่
          </button>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm("ยืนยันการยกเลิกงานนี้หรือไม่?")) {
                runAction(() => api.cancelVideoJob(jobId));
              }
            }}
          >
            ยกเลิกงาน
          </button>
        ) : null}
      </div>
    </aside>
  );
}
