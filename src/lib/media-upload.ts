// Browser-side media uploads.
//
// 1. Ask the server for a signed Supabase Storage URL (also creates the row).
// 2. PUT the file straight to Storage with progress, never through the app
//    server — serverless request-body limits make proxying large files unsafe.
// 3. Return the media asset row for the library or the editor.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useState } from "react";
import { createMediaUpload } from "@/lib/server-fns";
import type { MediaAssetRow } from "@/db/schema";

export type UploadOptions = {
  alt?: string;
  caption?: string;
  onProgress?: (percent: number) => void;
};

function putWithProgress(url: string, file: File, onProgress?: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}). ${xhr.responseText ?? ""}`.trim()));
    };
    xhr.onerror = () => reject(new Error("Upload failed — the connection was interrupted."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

/** Read pixel dimensions in the browser — no server-side image library needed. */
async function readDimensions(file: File): Promise<{ width?: number; height?: number }> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not read image"));
        image.src = url;
      });
      return { width: image.naturalWidth, height: image.naturalHeight };
    }
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Could not read video"));
        video.src = url;
      });
      return { width: video.videoWidth, height: video.videoHeight };
    }
  } catch {
    // Dimensions are optional metadata.
  } finally {
    URL.revokeObjectURL(url);
  }
  return {};
}

export async function uploadFileToLibrary(
  file: File,
  options: UploadOptions = {},
): Promise<MediaAssetRow> {
  const dimensions = await readDimensions(file);
  const created = await (createMediaUpload as any)({
    data: {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      ...dimensions,
      alt: options.alt ?? "",
      caption: options.caption ?? "",
    },
  });

  try {
    await putWithProgress(created.signedUrl, file, options.onProgress);
  } catch (error) {
    // Do not leave a database row pointing at a file that never arrived.
    const { deleteMedia } = await import("@/lib/server-fns");
    await (deleteMedia as any)({ data: { id: created.asset.id } }).catch(() => {});
    throw error;
  }

  return created.asset as MediaAssetRow;
}

/** File-type groups Koenig's uploader understands. */
export const KOENIG_FILE_TYPES = {
  image: {
    mimeTypes: ["image/gif", "image/jpg", "image/jpeg", "image/png", "image/svg+xml", "image/webp"],
    extensions: ["gif", "jpg", "jpeg", "png", "svg", "svgz", "webp"],
  },
  video: {
    mimeTypes: ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
    extensions: ["mp4", "webm", "ogv", "mov"],
  },
  audio: {
    mimeTypes: [
      "audio/mp3",
      "audio/mpeg",
      "audio/ogg",
      "audio/wav",
      "audio/vnd.wav",
      "audio/wave",
      "audio/x-wav",
      "audio/mp4",
      "audio/x-m4a",
    ],
    extensions: ["mp3", "wav", "ogg", "m4a"],
  },
  mediaThumbnail: {
    mimeTypes: ["image/gif", "image/jpg", "image/jpeg", "image/png", "image/webp"],
    extensions: ["gif", "jpg", "jpeg", "png", "webp"],
  },
  file: { mimeTypes: [], extensions: [] },
};

/**
 * Adapter for Koenig's `fileUploader.useFileUpload`. Returns a hook factory,
 * exactly as the editor expects.
 */
export function useMediaUpload() {
  return function useUpload(type = "") {
    const [progress, setProgress] = useState(100);
    const [isLoading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ message: string }[]>([]);
    const [filesNumber, setFilesNumber] = useState(0);

    const upload = useCallback(async (files: File[] | FileList) => {
      const list = Array.from(files);
      if (!list.length) return null;
      setLoading(true);
      setFilesNumber(list.length);
      setErrors([]);
      setProgress(0);
      const results: { url: string; fileName?: string }[] = [];
      try {
        for (let index = 0; index < list.length; index += 1) {
          const file = list[index]!;
          const asset = await uploadFileToLibrary(file, {
            onProgress: (percent) =>
              setProgress(Math.round(((index + percent / 100) / list.length) * 100)),
          });
          results.push({ url: asset.url, fileName: asset.name });
        }
        setProgress(100);
        return results;
      } catch (error: any) {
        setErrors([{ message: error?.message ?? "Upload failed" }]);
        return null;
      } finally {
        setLoading(false);
      }
    }, []);

    void type;
    return { isLoading, upload, progress, errors, filesNumber };
  };
}
