// OpenAI's Sora image-to-video requires the reference image to be EXACTLY the
// target output's pixel dimensions (confirmed by a live API error: "Inpaint
// image must match the requested width and height"). Ordinary product photos
// almost never happen to match, so we cover-crop + resize client-side before
// upload whenever the openai provider is selected.

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพได้"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Resizes/crops `file` to exactly `targetWidth`x`targetHeight`, using a
 * center-crop ("cover") strategy so the image fills the frame without
 * distortion (rather than stretching to fit).
 */
export async function resizeImageToExactSize(file, targetWidth, targetHeight) {
  const img = await loadImage(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    const sourceRatio = img.width / img.height;
    const targetRatio = targetWidth / targetHeight;

    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;

    if (sourceRatio > targetRatio) {
      // Source is wider than target — crop the sides.
      sw = img.height * targetRatio;
      sx = (img.width - sw) / 2;
    } else if (sourceRatio < targetRatio) {
      // Source is taller than target — crop top/bottom.
      sh = img.width / targetRatio;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("ปรับขนาดรูปภาพไม่สำเร็จ"))), "image/png");
    });

    const resizedName = file.name ? file.name.replace(/\.[^.]+$/, "") + "-resized.png" : "resized.png";
    return new File([blob], resizedName, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

/** Parses an OpenAI "size" string like "1280x720" into { width, height }. */
export function parseSizeString(sizeString) {
  const match = /^(\d+)x(\d+)$/.exec(String(sizeString || ""));
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}
