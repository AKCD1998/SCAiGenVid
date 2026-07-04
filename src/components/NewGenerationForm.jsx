import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { formatCostWithThb } from "../lib/format.js";
import { resizeImageToExactSize, parseSizeString } from "../lib/imageResize.js";
import StatusBadge from "./StatusBadge.jsx";

const ASPECT_RATIO_LABELS = {
  "16:9": "16:9 — Shopee / Facebook แนวนอน",
  "9:16": "9:16 — TikTok / Reels แนวตั้ง",
  "1:1": "1:1 — โพสต์สี่เหลี่ยมจัตุรัส",
};

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

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

  // imageFile holds the ORIGINAL file the user picked — kept around so we can
  // re-process (resize) it if provider/model/aspectRatio changes afterward,
  // without asking the user to re-select the file.
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageAssetId, setImageAssetId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [resizeNotice, setResizeNotice] = useState("");

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
    const models = config.providerModels?.[provider] || [];
    // Prefer sora-2 as the default model when picking a fresh one for a provider
    // (e.g. after switching providers) — it's the cheaper/faster option and a
    // more sensible starting point than whatever happens to be first in the list.
    const preferredModel = models.includes("sora-2") ? "sora-2" : models[0] || "";
    const nextModel = models.includes(model) ? model : preferredModel;
    if (nextModel !== model) {
      setModel(nextModel);
    }
    // Allowed durations depend on the specific model (e.g. sora-2 vs sora-2-pro),
    // not just the provider, so this must key off provider+model together.
    const durations = config.durationsByProviderModel?.[provider]?.[nextModel] || [];
    if (durations.length && !durations.includes(Number(durationSeconds))) {
      // Prefer 8 seconds as the default duration when one needs picking — a
      // reasonable middle ground, rather than always defaulting to the
      // shortest allowed option.
      const preferredDuration = durations.includes(8) ? 8 : durations[0];
      setDurationSeconds(String(preferredDuration));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, model, config]);

  // OpenAI's image-to-video requires the reference image to EXACTLY match the
  // output's pixel size — resolve what that target size is for the current
  // provider/model/aspectRatio combination (null for mock, which has no such
  // requirement).
  function resolveOpenAiTargetSize() {
    if (provider !== "openai") return null;
    const entry = config?.aspectRatioToOpenAiSize?.[aspectRatio];
    if (!entry) return null;
    const sizeString = model === "sora-2-pro" ? entry.pro : entry.default;
    return parseSizeString(sizeString);
  }

  async function processAndUpload(rawFile) {
    if (!rawFile) return;
    setUploading(true);
    setUploadError("");
    setResizeNotice("");

    try {
      let fileToUpload = rawFile;
      const targetSize = resolveOpenAiTargetSize();

      if (targetSize) {
        fileToUpload = await resizeImageToExactSize(rawFile, targetSize.width, targetSize.height);
        setResizeNotice(
          `ปรับขนาดรูปภาพเป็น ${targetSize.width}x${targetSize.height} พิกเซล ให้ตรงกับข้อกำหนดของ OpenAI แล้ว`,
        );
      }

      setImagePreviewUrl((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return URL.createObjectURL(fileToUpload);
      });

      const initData = await api.initAssetUpload({
        mimeType: fileToUpload.type,
        assetType: "input_image",
        originalFilename: fileToUpload.name,
      });

      await api.completeAssetUpload({ assetId: initData.assetId, file: fileToUpload });
      setImageAssetId(initData.assetId);
    } catch (error) {
      setImageAssetId(null);
      setUploadError(error.message || "อัปโหลดรูปภาพไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  // Re-process the original file whenever a setting that affects the required
  // image size changes (switching to/from openai, changing model, or aspect
  // ratio) — otherwise a previously-uploaded image could silently mismatch the
  // new target size and fail at submit time again.
  useEffect(() => {
    if (!imageFile || !config) return;
    setImageAssetId(null);
    processAndUpload(imageFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile, provider, model, aspectRatio, config]);

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

    // Setting imageFile triggers the effect above, which resizes (if needed)
    // and uploads automatically — no separate manual step required.
    setImageFile(file);
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setSubmitError("");

    if (!prompt.trim()) {
      setSubmitError("กรุณากรอก prompt");
      return;
    }

    // Guard against submitting while an image is selected but hasn't finished
    // uploading yet (or failed to upload) — otherwise the job silently gets
    // created with no input image at all, and the model has to invent the
    // product's appearance from the text prompt alone.
    if (imageFile && !imageAssetId) {
      setSubmitError(
        uploading
          ? "กำลังอัปโหลดรูปภาพอยู่ กรุณารอสักครู่แล้วลองใหม่"
          : "รูปภาพยังอัปโหลดไม่สำเร็จ กรุณาลองอัปโหลดใหม่ก่อน Generate",
      );
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
  const durations = config?.durationsByProviderModel?.[provider]?.[model] || [];
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
      {uploading ? <p className="subtle">กำลังประมวลผล/อัปโหลดรูปภาพ...</p> : null}
      {resizeNotice ? <p className="subtle">{resizeNotice}</p> : null}
      {uploadError ? <p className="message error-text">{uploadError}</p> : null}
      {imageFile && !imageAssetId && !uploading ? (
        <button type="button" onClick={() => processAndUpload(imageFile)} disabled={uploading}>
          ลองอัปโหลดใหม่
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
          ค่าใช้จ่ายโดยประมาณ: {formatCostWithThb(createdJob?.estimatedCost, config?.usdToThbRate)}
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
        <button type="submit" className="primary" disabled={submitting || uploading}>
          {submitting ? "กำลังส่งงาน..." : uploading ? "รอรูปภาพอัปโหลดก่อน..." : "Generate"}
        </button>
      </div>
    </form>
  );
}
