/* eslint-disable @typescript-eslint/no-explicit-any */
// Public certificates view — visible certificates, expiry badge, PDF preview,
// with an expanded thumbnail/PDF viewer accessible from each certificate card.

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isPast } from "date-fns";
import { Media } from "@/components/media";
import { Link } from "@tanstack/react-router";
import { ExternalLink, FileText, Maximize, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

export function CertificatesView({ content }: { content: any }) {
  const certificates = (content.certificates ?? [])
    .filter((c: any) => c.visible !== false)
    .sort((a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0));

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewSrc, setPreviewSrc] = React.useState("");
  const [expandedOpen, setExpandedOpen] = React.useState(false);
  const [expandedSrc, setExpandedSrc] = React.useState("");
  const [expandedType, setExpandedType] = React.useState<"image" | "pdf">("image");
  const [expandedTitle, setExpandedTitle] = React.useState("");

  const getMediaKind = (src: string): "image" | "pdf" => {
    const ext =
      src
        .split(/[?#]/)[0]
        ?.match(/\.([a-z0-9]+)$/i)?.[1]
        ?.toLowerCase() ?? "";
    return ext === "pdf" ? "pdf" : "image";
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl text-foreground">Certificates</h2>
      {certificates.length === 0 && (
        <p className="text-muted-foreground">No certificates to display.</p>
      )}
      {certificates.map((cert: any) => {
        const expired = cert.expiryDate && isPast(parseISO(cert.expiryDate));
        const hasMedia = Boolean(cert.image?.src || cert.file?.src);
        const mediaSrc = cert.image?.src ?? cert.file?.src;
        const mediaKind = mediaSrc ? getMediaKind(mediaSrc) : "image";

        return (
          <article
            key={cert.id}
            data-testid="public-certificate"
            className="border-b border-border py-6 last:border-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              {cert.category && (
                <span className="label-caps text-[0.65rem] text-muted-foreground">
                  {cert.category}
                </span>
              )}
              {cert.featured && (
                <Badge variant="outline" className="text-[0.65rem] px-2 py-0.5">
                  Featured
                </Badge>
              )}
              {expired && (
                <Badge variant="destructive" className="text-[0.65rem] px-2 py-0.5">
                  Expired
                </Badge>
              )}
            </div>
            <h3 className="text-2xl text-foreground">{cert.title}</h3>
            <p className="font-serif text-muted-foreground">
              {cert.issuer}
              {cert.issueDate ? ` · ${format(parseISO(cert.issueDate), "MMMM yyyy")}` : ""}
            </p>
            {cert.description && (
              <p className="text-sm text-muted-foreground mt-1">{cert.description}</p>
            )}
            <div className="mt-4 flex items-center gap-4">
              {hasMedia && (
                <div
                  className="relative aspect-[16/9] w-48 overflow-hidden bg-muted rounded border border-border cursor-pointer hover:border-primary transition-colors"
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${cert.title} media larger`}
                  onClick={() => {
                    setExpandedSrc(mediaSrc);
                    setExpandedType(mediaKind);
                    setExpandedTitle(cert.title);
                    setExpandedOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedSrc(mediaSrc);
                      setExpandedType(mediaKind);
                      setExpandedTitle(cert.title);
                      setExpandedOpen(true);
                    }
                  }}
                >
                  <Media items={[{ src: mediaSrc }]} />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Maximize className="h-6 w-6 text-white" />
                    <span className="sr-only">Click to view larger</span>
                  </div>
                </div>
              )}
              {!hasMedia && (
                <div className="aspect-[16/9] w-48 overflow-hidden bg-muted rounded border border-dashed flex items-center justify-center text-muted-foreground text-sm">
                  <FileText className="h-8 w-8" />
                </div>
              )}
              {cert.credentialUrl && (
                <a
                  href={cert.credentialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link underline hover:underline"
                >
                  Verify credential ↗
                </a>
              )}
            </div>

            {/* Expanded media viewer */}
            {expandedOpen && expandedSrc && (
              <Dialog open={expandedOpen} onOpenChange={setExpandedOpen}>
                <DialogContent className="w-[95vh] max-w-[95vh] h-[90vh] max-h-[90vh] p-0 bg-black">
                  <DialogTitle className="text-white mb-4">
                    {expandedTitle || "Certificate"}
                  </DialogTitle>
                  <div className="flex flex-col items-center justify-center h-full w-full bg-black text-white p-4">
                    {expandedType === "pdf" ? (
                      <div className="relative w-full h-full max-w-[90vw] max-h-[85vh]">
                        <iframe
                          src={expandedSrc}
                          title={expandedTitle}
                          className="w-full h-full"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="relative w-full h-full max-w-[90vw] max-h-[85vh] flex items-center justify-center">
                        <img
                          src={expandedSrc}
                          alt={expandedTitle}
                          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white p-2"
                          onError={(e) => {
                            e.currentTarget.className = "hidden";
                          }}
                        />
                      </div>
                    )}
                    <div className="mt-4 flex justify-center gap-2">
                      {expandedType === "image" && mediaSrc && (
                        <a
                          href={expandedSrc}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="text-sm">Open image in new tab</span>
                        </a>
                      )}
                      {expandedType === "pdf" && mediaSrc && (
                        <a
                          href={expandedSrc}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">Open PDF in new tab</span>
                        </a>
                      )}
                    </div>
                  </div>
                  <DialogPrimitive.Close className="absolute right-6 top-6 rounded-full bg-black/50 text-white p-2 hover:bg-white/20 transition-colors">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </DialogContent>
              </Dialog>
            )}

            {/* Existing PDF dialog (kept for backward compatibility)} */}
            {cert.file && (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    className="mt-3 text-xs text-primary underline-offset-4 hover:underline"
                    onClick={() => {
                      setPreviewSrc(cert.file.src);
                      setPreviewOpen(true);
                    }}
                  >
                    Open PDF
                  </button>
                </DialogTrigger>
                <DialogContent className="w-[90vh] max-w-[90vh] h-[80vh]">
                  <DialogTitle>{cert.title}</DialogTitle>
                  <DialogDescription>
                    <iframe src={previewSrc} title={cert.title} className="w-full h-full" />
                  </DialogDescription>
                </DialogContent>
              </Dialog>
            )}
          </article>
        );
      })}
    </div>
  );
}
