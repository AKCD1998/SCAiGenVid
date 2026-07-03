const STATUS_LABELS = {
  draft: "ร่าง",
  queued: "รอคิว",
  processing: "กำลังสร้าง",
  completed: "เสร็จสิ้น",
  failed: "ล้มเหลว",
  cancelled: "ยกเลิก",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
};

const NON_TERMINAL_STATUSES = ["draft", "queued", "processing"];

export function isTerminalStatus(status) {
  return !NON_TERMINAL_STATUSES.includes(status);
}

export default function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status || "ไม่ทราบสถานะ";
  return <span className={`status-pill status-${status}`}>{label}</span>;
}
