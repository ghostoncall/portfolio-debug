import { describe, expect, it } from "vitest";
import { detectMediaKind, youtubeEmbedUrl } from "@/components/media";

describe("media placeholder accepts any file type", () => {
  it("shows a placeholder when no file is given", () => {
    expect(detectMediaKind({})).toBe("empty");
  });
  it("recognises pictures", () => {
    expect(detectMediaKind({ src: "/files/photo.JPEG" })).toBe("image");
    expect(detectMediaKind({ src: "/files/logo.png?v=2" })).toBe("image");
  });
  it("recognises PDFs", () => {
    expect(detectMediaKind({ src: "/files/certificate.pdf" })).toBe("pdf");
  });
  it("recognises PowerPoint and Word files", () => {
    expect(detectMediaKind({ src: "/files/talk.pptx" })).toBe("office");
    expect(detectMediaKind({ src: "/files/talk.ppt" })).toBe("office");
    expect(detectMediaKind({ src: "/files/resume.docx" })).toBe("office");
  });
  it("recognises videos and YouTube links", () => {
    expect(detectMediaKind({ src: "/files/demo.mp4" })).toBe("video");
    expect(detectMediaKind({ src: "https://youtu.be/dQw4w9WgXcQ" })).toBe("youtube");
    expect(youtubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
  it("falls back to a download card for unknown formats", () => {
    expect(detectMediaKind({ src: "/files/model-weights.zip" })).toBe("file");
    expect(detectMediaKind({ src: "/files/notes" })).toBe("file");
  });
});
