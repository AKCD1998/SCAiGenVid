import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";

function formatUsd(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatThb(value) {
  return `${Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`;
}

function SummaryCard({ label, usage }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <p>
        จำนวนงาน: {usage?.jobCount ?? 0}
        <br />
        ค่าใช้จ่ายประมาณการ: {formatUsd(usage?.totalEstimatedCostUsd)} (≈{formatThb(usage?.totalEstimatedCostThb)})
        <br />
        ค่าใช้จ่ายจริง: {formatUsd(usage?.totalActualCostUsd)} (≈{formatThb(usage?.totalActualCostThb)})
      </p>
    </div>
  );
}

export default function UsagePage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.getUsageSummary();
        if (active) setSummary(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : "โหลดข้อมูลการใช้งานไม่สำเร็จ");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="subtle">กำลังโหลด...</p>;
  }

  if (error) {
    return <p className="message error-text">{error}</p>;
  }

  return (
    <div className="usage-layout">
      <section className="panel">
        <div className="panel-header">
          <h2>การใช้งานและค่าใช้จ่าย</h2>
        </div>
        <p className="subtle">
          ค่าใช้จ่ายเป็นตัวเลขประมาณการจากราคาที่ OpenAI เผยแพร่ (ไม่ใช่ยอดเรียกเก็บจริง เนื่องจาก Sora API
          ไม่ส่งข้อมูลการใช้งานจริงกลับมา) แปลงเป็นบาทด้วยอัตราคงที่ที่ตั้งค่าไว้ในระบบ (
          {summary?.usdToThbRate ?? "-"} บาท/ดอลลาร์) — ไม่ใช่อัตราแลกเปลี่ยนสด
        </p>
        <div className="summary-grid">
          <SummaryCard label="เดือนนี้" usage={summary?.thisMonth} />
          <SummaryCard label="ทั้งหมด (All-time)" usage={summary?.allTime} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>แยกตาม Provider / Model</h2>
        </div>
        {summary?.byProviderModel?.length ? (
          <div className="table-shell">
            <table className="job-history-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>จำนวนงาน</th>
                  <th>ประมาณการ (USD)</th>
                  <th>ประมาณการ (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {summary.byProviderModel.map((row) => (
                  <tr key={`${row.provider}-${row.model}`}>
                    <td>{row.provider}</td>
                    <td>{row.model}</td>
                    <td>{row.jobCount}</td>
                    <td>{formatUsd(row.totalEstimatedCostUsd)}</td>
                    <td>{formatThb(row.totalEstimatedCostThb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">ยังไม่มีข้อมูล</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>แยกตามผู้ใช้งาน</h2>
        </div>
        {summary?.byUser?.length ? (
          <div className="table-shell">
            <table className="job-history-table">
              <thead>
                <tr>
                  <th>ผู้สร้างงาน</th>
                  <th>จำนวนงาน</th>
                  <th>ประมาณการ (USD)</th>
                  <th>ประมาณการ (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {summary.byUser.map((row) => (
                  <tr key={row.createdBy}>
                    <td>{row.createdBy}</td>
                    <td>{row.jobCount}</td>
                    <td>{formatUsd(row.totalEstimatedCostUsd)}</td>
                    <td>{formatThb(row.totalEstimatedCostThb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">ยังไม่มีข้อมูล</p>
        )}
      </section>
    </div>
  );
}
