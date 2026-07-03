import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { can } from "../lib/permissions.js";
import NewGenerationForm from "../components/NewGenerationForm.jsx";

export default function NewJobPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [lastCreatedJob, setLastCreatedJob] = useState(null);

  if (!can(role, "content.video.create")) {
    return (
      <section className="panel">
        <h2>ไม่มีสิทธิ์สร้างงานใหม่</h2>
        <p className="subtle">บทบาทของคุณ ({role}) สามารถดูได้เฉพาะงานที่อนุมัติแล้วในหน้า History</p>
      </section>
    );
  }

  return (
    <section>
      <NewGenerationForm onJobCreated={setLastCreatedJob} />
      {lastCreatedJob ? (
        <div className="notice success">
          ส่งงานสำเร็จแล้ว (Job #{lastCreatedJob.jobPublicId || lastCreatedJob.jobId}){" "}
          <button type="button" className="text-link-button" onClick={() => navigate("/history")}>
            ไปที่หน้าประวัติ
          </button>
        </div>
      ) : null}
    </section>
  );
}
