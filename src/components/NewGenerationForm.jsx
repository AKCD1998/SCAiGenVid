import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import StatusBadge from "./StatusBadge.jsx";

const ASPECT_RATIO_LABELS = {
  "16:9": "16:9 — Shopee / Facebook แนวนอน",
  "9:16": "9:16 — TikTok / Reels แนวตั้ง",
  "1:1": "1:1 — โพสต์สี่เหลี่ยมจัตุรัส",
};

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

function formatCost(cost) {
  if (cost === null || cost === undefined) return "N/A";
  return `$${Number(cost).toFixed(2)}`;
}

export default function NewGenerationForm({ onJobCreated }) {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");

  const [sku, setSku] = useState("");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [provider, setProvider] = useState("mock");
  const [model, setModel] = useState("");

  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageAssetId, setImageAssetId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createdJob, setCreatedJob] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const data = await api.getVideoJobConfig();
        if (!active) return;
        setConfig(data);
        setAspectRatio((prev) => prev || data?.aspectRatios?.[0] || "");
        setProvider((prev) => {
          const next = data?.providers?.includes("mock") ? "mock" : data?.providers?.[0] || prev;
          return next;
        });
      } catch (error) {
        if (!active) return;
        setConfigError(error.message || "โหลดการตั้งค่าไม่สำเร็จ");
      }
    }

    loadConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!config) return;
    const durations = config.durationsByProvider?.[provider] || [];
    if (durations.length && !durations.includes(Number(durationSeconds))) {
      setDurationSeconds(String(durations[0]));
    }
    const models = config.providerModels?.[provider] || [];
    if (models.length && !models.includes(model)) {
      setModel(models[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, config]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    validateAndStoreFile(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    validateAndStoreFile(file);
  }

  function validateAndStoreFile(file) {
    setUploadError("");

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("รองรับเฉพาะไฟล์ PNG, JPEG หรือ WEBP เท่านั้น");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("ขนาดไฟล์ต้องไม่เกิน 10MB");
      return;
    }

    setImageFile(file);
    setImageAssetId(null);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  async function handleUpload() {
    if (!imageFile) return;
    setUploading(true);
    setUploadError("");

    try {
      const initData = await api.initAssetUpload({
        mimeType: imageFile.type,
        assetType: "input_image",
        originalFilename: imageFile.name,
      });

      await api.completeAssetUpload({ assetId: initData.assetId, file: imageFile });
      setImageAssetId(initData.assetId);
    } catch (error) {
      setUploadError(error.message || "อัปโหลดรูปภาพไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setSubmitError("");

    if (!prompt.trim()) {
      setSubmitError("กรุณากรอก prompt");
      return;
    }

    setSubmitting(true);

    try {
      const created = await api.createVideoJob({
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        aspectRatio,
        durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
        provider,
        model,
        inputAssetId: imageAssetId || undefined,
        productIdOrSkuReference: sku.trim() || undefined,
      });

      const job = created.job || created;
      const submitted = await api.submitVideoJob(job.jobId || job.id);
      const finalJob = submitted.job || submitted;

      setCreatedJob(finalJob);
      onJobCreated?.(finalJob);
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else {
        setSubmitError("ส่งงานไม่สำเร็จ กรุณาลองใหม่");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const promptMax = config?.promptMaxLength || null;
  const durations = config?.durationsByProvider?.[provider] || [];
  const models = config?.providerModels?.[provider] || [];
  const providers = config?.providers || ["mock"];
  const aspectRatios = config?.aspectRatios || ["16:9", "9:16", "1:1"];

  return (
    <form className="panel" onSubmit={handleGenerate}>
      <div className="panel-header">
        <h2>สร้างวิดีโอใหม่</h2>
      </div>

      {configError ? <p className="message error-text">{configError}</p> : null}

      <label>
        SKU / รหัสสินค้า (ไม่บังคับ)
        <input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="เช่น SKU-00123" />
      </label>

      <label>รูปภาพสินค้า</label>
      <div
        className="dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        {imagePreviewUrl ? (
          <img src={imagePreviewUrl} alt="ตัวอย่างรูปสินค้า" className="dropzone-preview" />
        ) : (
          <p className="subtle">ลากไฟล์รูปมาวางที่นี่ หรือเลือกไฟล์ (PNG/JPEG/WEBP, สูงสุด 10MB)</p>
        )}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
      </div>
      {uploadError ? <p className="message error-text">{uploadError}</p> : null}
      {imageFile && !imageAssetId ? (
        <button type="button" onClick={handleUpload} disabled={uploading}>
          {uploading ? "กำลังอัปโหลด..." : "อัปโหลดรูปนี้"}
        </button>
      ) : null}
      {imageAssetId ? <p className="message success-text">อัปโหลดรูปสำเร็จแล้ว</p> : null}

      <label>
        Prompt (จำเป็น)
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          placeholder="อธิบายวิดีโอที่ต้องการสร้าง"
          maxLength={promptMax || undefined}
        />
        {promptMax ? (
          <span className="char-counter">
            {prompt.length} / {promptMax}
          </span>
        ) : null}
      </label>

      <label>
        Negative Prompt (ไม่บังคับ)
        <textarea
          value={negativePrompt}
          onChange={(event) => setNegativePrompt(event.target.value)}
          rows={2}
          placeholder="สิ่งที่ไม่ต้องการให้ปรากฏในวิดีโอ"
        />
      </label>

      <label>
        อัตราส่วนภาพ
        <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
          {aspectRatios.map((ratio) => (
            <option key={ratio} value={ratio}>
              {ASPECT_RATIO_LABELS[ratio] || ratio}
            </option>
          ))}
        </select>
      </label>

      <label>
        ความยาว (วินาที)
        <select value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)}>
          {durations.map((duration) => (
            <option key={duration} value={duration}>
              {duration} วินาที
            </option>
          ))}
        </select>
      </label>

      <label>
        ผู้ให้บริการ (Provider)
        <select value={provider} onChange={(event) => setProvider(event.target.value)}>
          {providers.map((providerOption) => (
            <option key={providerOption} value={providerOption}>
              {providerOption}
            </option>
          ))}
        </select>
      </label>

      <label>
        โมเดล
        <select value={model} onChange={(event) => setModel(event.target.value)}>
          {models.map((modelOption) => (
            <option key={modelOption} value={modelOption}>
              {modelOption}
            </option>
          ))}
        </select>
      </label>

      <div className="summary-card">
        <span>สรุปรายการ</span>
        <p>
          รูปภาพ: {imageAssetId ? "อัปโหลดแล้ว" : "ยังไม่ได้อัปโหลด"}
          <br />
          รูปแบบ: {ASPECT_RATIO_LABELS[aspectRatio] || aspectRatio || "-"} · {durationSeconds || "-"} วินาที
          <br />
          Provider/Model: {provider} / {model || "-"}
          <br />
          ค่าใช้จ่ายโดยประมาณ: {formatCost(createdJob?.estimatedCost)}
          {createdJob ? (
            <>
              <br />
              สถานะปัจจุบัน: <StatusBadge status={createdJob.status} />
            </>
          ) : null}
        </p>
      </div>

      {submitError ? <p className="message error-text">{submitError}</p> : null}

      <div className="form-actions">
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? "กำลังส่งงาน..." : "Generate"}
        </button>
      </div>
    </form>
  );
}
