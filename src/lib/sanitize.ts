import DOMPurify from "dompurify";

// Tags that model configs and documents legitimately use. Anything not listed
// is dropped, so an injected script/iframe/form never reaches the DOM.
const BASIC_TAGS = [
    "p",
    "br",
    "hr",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "sub",
    "sup",
    "code",
    "pre",
    "ul",
    "ol",
    "li",
    "blockquote",
    "span",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
];
const IMG_TAG = "img";

const BASIC_ATTR = ["href", "title", "class", "colspan", "rowspan"];
const IMG_ATTR = ["src", "alt"];

// Layout classes used by model descriptions. Everything else is stripped:
// arbitrary utility classes would let a remote config spoof the app UI.
const ALLOWED_CLASSES = new Set([
    "font-bold",
    "font-semibold",
    "font-medium",
    "font-normal",
    "text-xs",
    "text-sm",
    "text-base",
    "text-lg",
    "text-xl",
    "text-center",
    "text-left",
    "text-right",
    "text-gray-400",
    "text-gray-500",
    "text-gray-600",
    "text-gray-700",
    "text-gray-900",
    "text-red-500",
    "text-red-600",
    "text-green-500",
    "text-green-600",
    "text-blue-500",
    "text-blue-600",
    "text-orange-500",
    "whitespace-pre-wrap",
    "break-all",
    "break-words",
]);
const ALLOWED_CLASS_PATTERN = /^(?:m[btlr]?|p[xy]?|mx|my)-\d{1,2}$/;

// Only http(s) or inline raster images. file: is rejected on purpose: with
// webSecurity off, a file:// image can probe paths on the local disk.
const SAFE_IMG_SRC =
    /^(?:https?:\/\/|data:image\/(?:png|jpe?g|gif|webp);base64,)/i;

let hooksInstalled = false;

const installHooks = () => {
    if (hooksInstalled) {
        return;
    }
    hooksInstalled = true;

    DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
        if (data.attrName !== "class") {
            return;
        }
        const kept = String(data.attrValue || "")
            .split(/\s+/)
            .filter(
                (name) =>
                    name &&
                    (ALLOWED_CLASSES.has(name) ||
                        ALLOWED_CLASS_PATTERN.test(name)),
            );
        if (kept.length) {
            data.attrValue = kept.join(" ");
        } else {
            data.keepAttr = false;
        }
    });

    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
        const el = node as Element;
        if (el.tagName === "A") {
            // Sanitized links must never navigate the Electron window itself.
            el.setAttribute("rel", "noopener noreferrer");
            el.removeAttribute("target");
        } else if (el.tagName === "IMG") {
            const src = el.getAttribute("src") || "";
            if (!SAFE_IMG_SRC.test(src)) {
                el.removeAttribute("src");
            }
            el.setAttribute("loading", "lazy");
            el.setAttribute("referrerpolicy", "no-referrer");
        }
    });
};

export type HtmlProfile = "basic" | "rich";

/**
 * Sanitize untrusted HTML against an allowlist.
 * `basic` is for model/server descriptions, `rich` additionally allows images.
 */
export function sanitizeHtml(
    html: string | null | undefined,
    profile: HtmlProfile = "basic",
): string {
    const input = String(html ?? "");
    if (!input) {
        return "";
    }
    installHooks();
    return DOMPurify.sanitize(input, {
        ALLOWED_TAGS:
            profile === "rich" ? [...BASIC_TAGS, IMG_TAG] : BASIC_TAGS,
        ALLOWED_ATTR:
            profile === "rich" ? [...BASIC_ATTR, ...IMG_ATTR] : BASIC_ATTR,
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: false,
        SANITIZE_DOM: true,
        // Neutralize mustache syntax so content cannot become a Vue template.
        SAFE_FOR_TEMPLATES: true,
    }) as unknown as string;
}

export function escapeHtml(text: string | null | undefined): string {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
