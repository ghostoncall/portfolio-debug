// The real Koenig mount. Loaded lazily from KoenigBodyEditor so the 0.86 MB
// editor bundle (and its CSS) never reaches the public site.
//
// Font size is applied per-paragraph via HTML <span style="font-size: ...">.
// The size is preserved in body.html and survives reopening via
// HtmlOutputPlugin's HTML import. On every editor change, stored font sizes
// are re-applied to the regenerated HTML so they persist across edits.
import { useCallback, useEffect, useRef, useState } from "react";
import { HtmlOutputPlugin, KoenigComposer, KoenigEditor } from "@tryghost/koenig-lexical";
import "@tryghost/koenig-lexical/style.css";
import { KOENIG_FILE_TYPES, useMediaUpload } from "@/lib/media-upload";

export type KoenigValue = {
  lexical: Record<string, unknown>;
  html: string;
};

type Props = {
  initialLexical?: Record<string, unknown> | null;
  initialHtml?: string;
  onChange: (value: KoenigValue) => void;
  onReady?: () => void;
  siteTitle?: string;
  siteDescription?: string;
  siteUrl?: string;
  fontBody?: string;
  fontHeading?: string;
  fontBodyScale?: number;
  fontHeadingScale?: number;
  fontSize?: string;
  onFontSizeChange?: (size: string) => void;
};

export default function KoenigInner({
  initialLexical,
  initialHtml,
  onChange,
  onReady,
  siteTitle = "",
  siteDescription = "",
  siteUrl = "",
  fontBody,
  fontHeading,
  fontBodyScale,
  fontHeadingScale,
  fontSize = "16px",
  onFontSizeChange,
}: Props) {
  const useFileUpload = useMediaUpload();
  const latest = useRef<KoenigValue>({
    lexical: (initialLexical ?? {}) as Record<string, unknown>,
    html: initialHtml ?? "",
  });
  const timer = useRef<number | null>(null);
  const ready = useRef(false);
  const [appliedFontSize, setAppliedFontSize] = useState<string>(fontSize);

  // Paragraph-level font size map: paragraph index -> font size
  const [fontSizeMap, setFontSizeMap] = useState<Record<number, string>>({});

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!ready.current) {
        ready.current = true;
        onReady?.();
      }
      onChange({ lexical: latest.current.lexical, html: latest.current.html });
    }, 60);
  }, [onChange, onReady]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  // Re-apply stored font sizes to regenerated HTML
  const applyFontSizesToHtml = useCallback(
    (html: string): string => {
      if (Object.keys(fontSizeMap).length === 0) return html;
      const parts = html.split(/(<p[^>]*>)/);
      let pIndex = 0;
      const result = parts.map((part) => {
        if (/^<p[^>]*>$/.test(part)) {
          const size = fontSizeMap[pIndex];
          pIndex += 1;
          if (size) {
            return part.replace(/<p>/, `<p style="font-size:${size}">`);
          }
          return part;
        }
        return part;
      });
      return result.join("");
    },
    [fontSizeMap],
  );

  // Sync appliedFontSize when the parent-controlled fontSize prop changes
  useEffect(() => {
    if (fontSize && fontSize !== appliedFontSize) {
      setAppliedFontSize(fontSize);
      setFontSizeMap((prev) => ({ ...prev, [0]: fontSize }));
      const htmlWithSizes = applyFontSizesToHtml(latest.current.html);
      latest.current.html = htmlWithSizes;
      schedule();
      if (onFontSizeChange) onFontSizeChange(fontSize);
    }
  }, [fontSize, appliedFontSize, applyFontSizesToHtml, schedule, onFontSizeChange]);

  const cardConfig = {
    siteTitle,
    siteDescription,
    siteUrl,
    membersEnabled: false,
    stripeEnabled: false,
    renderLabels: false,
    feature: { transistor: false },
    post: { displayName: "post", visibility: "public" },
  };

  const style = {
    "--kg-font-body": fontBody,
    "--kg-font-heading": fontHeading,
    "--kg-font-body-scale": fontBodyScale ? String(fontBodyScale) : undefined,
    "--kg-font-heading-scale": fontHeadingScale ? String(fontHeadingScale) : undefined,
  } as React.CSSProperties;

  const handleEditorChange = useCallback(
    (json: Record<string, unknown>) => {
      latest.current.lexical = json;
      schedule();
    },
    [schedule],
  );

  // setHtml receives the freshly generated HTML from HtmlOutputPlugin.
  // Re-apply stored font sizes here so they persist across edits.
  const handleHtmlChange = useCallback(
    (html: string) => {
      const htmlWithSizes = applyFontSizesToHtml(html);
      latest.current.html = htmlWithSizes;
      schedule();
    },
    [applyFontSizesToHtml, schedule],
  );

  const handleFontSizeChange = useCallback(
    (size: string) => {
      setAppliedFontSize(size);
      setFontSizeMap((prev) => ({ ...prev, [0]: size }));
      const htmlWithSizes = applyFontSizesToHtml(latest.current.html);
      latest.current.html = htmlWithSizes;
      schedule();
      if (onFontSizeChange) onFontSizeChange(size);
    },
    [applyFontSizesToHtml, onFontSizeChange, schedule],
  );

  return (
    <div className="koenig-host" style={style}>
      <KoenigComposer
        initialEditorState={initialLexical ? initialLexical : null}
        fileUploader={{ useFileUpload, fileTypes: KOENIG_FILE_TYPES }}
        cardConfig={cardConfig}
        onError={(error: unknown) => console.error("[koenig]", error)}
      >
        <KoenigEditor onChange={handleEditorChange} />
        <HtmlOutputPlugin
          html={initialLexical ? "" : (initialHtml ?? "")}
          setHtml={handleHtmlChange}
        />
      </KoenigComposer>
    </div>
  );
}
