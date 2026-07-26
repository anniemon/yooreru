"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALargeSmall, CodeXml, ImagePlus, Link2, Save } from "lucide-react";
import { autosavePost, savePost, uploadEditorImage } from "@/app/admin/actions";
import { formatDateTimeLocal } from "@/lib/time-zone";
import type { AdminCategory } from "@/services/admin-categories";

type PostFormValue = {
  id?: number;
  title?: string;
  slug?: string;
  excerpt?: string;
  contentHtml?: string;
  status?: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  publishedAt?: Date | null;
  featuredImageUrl?: string | null;
  allowComments?: boolean;
  category?: { id?: number; name: string } | null;
  tags?: { name: string }[];
};

const AUTOSAVE_INTERVAL_MS = 10 * 60 * 1000;
const AUTOSAVE_FIELD_NAMES = [
  "id",
  "title",
  "slug",
  "excerpt",
  "contentHtml",
  "status",
  "featuredImageUrl",
  "allowComments",
  "categoryId",
  "tags",
] as const;

const FONT_OPTIONS = [
  { label: "기본", className: "" },
  { label: "Noto Serif KR", className: "has-noto-serif-kr-font-family" },
  { label: "Noto Sans KR", className: "has-noto-sans-kr-font-family" },
  { label: "Pretendard", className: "has-pretendard-font-family" },
] as const;

const FONT_SIZE_OPTIONS = [
  { label: "기본", className: "" },
  { label: "작게", className: "has-small-font-size" },
  { label: "보통", className: "has-medium-font-size" },
  { label: "크게", className: "has-large-font-size" },
  { label: "매우 크게", className: "has-x-large-font-size" },
] as const;

type EditorFontClass = (typeof FONT_OPTIONS)[number]["className"];
type EditorFontSizeClass = (typeof FONT_SIZE_OPTIONS)[number]["className"];

const EDITOR_FONT_CLASSES = FONT_OPTIONS.map((option) => option.className).filter(Boolean);
const EDITOR_FONT_SIZE_CLASSES = FONT_SIZE_OPTIONS.map((option) => option.className).filter(Boolean);

function categoryLabel(category: AdminCategory, categories: AdminCategory[]) {
  const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function isPostCategoryOption(category: AdminCategory) {
  return Boolean(category.parentId) && category.slug !== "geuneege" && category.name !== "그네에게";
}

function readImageDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function isBlankEditorHtml(contentHtml: string) {
  if (/<img\b/i.test(contentHtml)) {
    return false;
  }

  const template = document.createElement("template");
  template.innerHTML = contentHtml;
  return !template.content.textContent?.trim();
}

function hasAutosaveContent(title: string, contentHtml: string) {
  return Boolean(title || !isBlankEditorHtml(contentHtml));
}

function createAutosaveFingerprint(formData: FormData) {
  return JSON.stringify(AUTOSAVE_FIELD_NAMES.map((name) => [name, formData.get(name) ?? ""]));
}

function formatAutosaveTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminPostForm({
  post,
  categories,
  timeZone,
}: {
  post?: PostFormValue;
  categories: AdminCategory[];
  timeZone: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const linkUrlInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const autosaveInFlightRef = useRef(false);
  const lastAutosaveSnapshotRef = useRef("");
  const isComposingRef = useRef(false);
  const initializedContentRef = useRef(false);
  const initialContentHtml = useMemo(() => post?.contentHtml ?? "<p><br></p>", [post?.contentHtml]);
  const autosaveAllowed = !post?.id || post.status === "DRAFT";
  const defaultPublishedAt = useMemo(
    () => formatDateTimeLocal(post?.publishedAt ?? (!post?.id ? new Date() : null), timeZone),
    [post?.id, post?.publishedAt, timeZone],
  );
  const categoryOptions = useMemo(() => categories.filter(isPostCategoryOption), [categories]);
  const [postId, setPostId] = useState<number | null>(post?.id ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [autosaving, setAutosaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("");
  const [autosaveError, setAutosaveError] = useState("");
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");
  const [htmlSource, setHtmlSource] = useState(initialContentHtml);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkError, setLinkError] = useState("");
  const defaultCategoryId = useMemo(
    () =>
      String(
        post?.category?.id ??
          (!post?.id ? categoryOptions.find((category) => category.slug === "fingertip")?.id : "") ??
          "",
      ),
    [categoryOptions, post?.category?.id, post?.id],
  );

  const syncEditor = useCallback(() => {
    const contentHtml = editorRef.current?.innerHTML.trim() || "<p><br></p>";
    if (contentInputRef.current) {
      contentInputRef.current.value = contentHtml;
    }
    return contentHtml;
  }, []);

  const syncActiveEditor = useCallback(() => {
    if (editorMode === "html") {
      const contentHtml = htmlSource.trim() || "<p><br></p>";
      if (contentInputRef.current) {
        contentInputRef.current.value = contentHtml;
      }
      return contentHtml;
    }

    return syncEditor();
  }, [editorMode, htmlSource, syncEditor]);

  function setEditorNode(node: HTMLDivElement | null) {
    editorRef.current = node;
    if (!node || initializedContentRef.current) {
      return;
    }

    node.innerHTML = initialContentHtml;
    syncEditor();
    initializedContentRef.current = true;
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    editorRef.current?.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    if (savedRangeRef.current) {
      selection?.addRange(savedRangeRef.current);
    }
  }

  function topLevelEditorNode(node: Node): ChildNode | null {
    const editor = editorRef.current;
    if (!editor) {
      return null;
    }

    let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (current?.parentNode && current.parentNode !== editor) {
      current = current.parentNode;
    }

    return current?.parentNode === editor ? (current as ChildNode) : null;
  }

  function removeEditorClasses(element: HTMLElement, classNames: string[]) {
    element.classList.remove(...classNames);
    if (!element.getAttribute("class")) {
      element.removeAttribute("class");
    }
  }

  function setEditorClass(element: HTMLElement, classNames: string[], className: string) {
    removeEditorClasses(element, classNames);
    if (className) {
      element.classList.add(className);
    }
  }

  function clearNestedEditorClasses(element: HTMLElement, classNames: string[]) {
    removeEditorClasses(element, classNames);
    const selector = classNames.map((className) => `.${className}`).join(",");
    element.querySelectorAll<HTMLElement>(selector).forEach((node) => removeEditorClasses(node, classNames));
  }

  function selectedTopLevelNodes(range: Range) {
    const editor = editorRef.current;
    if (!editor) {
      return [];
    }

    return Array.from(editor.childNodes).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && range.intersectsNode(node),
    );
  }

  function applyEditorClass(className: string, classNames: string[]) {
    restoreSelection();

    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

    const topLevelNodes = selectedTopLevelNodes(range);
    const currentNode = topLevelEditorNode(range.startContainer);

    if (selection.isCollapsed || !className || topLevelNodes.length !== 1) {
      const targets = topLevelNodes.length ? topLevelNodes : currentNode instanceof HTMLElement ? [currentNode] : [];
      targets.forEach((node) => {
        if (className) {
          setEditorClass(node, classNames, className);
        } else {
          clearNestedEditorClasses(node, classNames);
        }
      });
      syncEditor();
      saveSelection();
      return;
    }

    const span = document.createElement("span");
    setEditorClass(span, classNames, className);
    span.append(range.extractContents());
    range.insertNode(span);

    const nextRange = document.createRange();
    nextRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    savedRangeRef.current = nextRange.cloneRange();
    syncEditor();
  }

  function applyFontClass(fontClass: EditorFontClass) {
    applyEditorClass(fontClass, EDITOR_FONT_CLASSES);
  }

  function applyFontSizeClass(fontSizeClass: EditorFontSizeClass) {
    applyEditorClass(fontSizeClass, EDITOR_FONT_SIZE_CLASSES);
  }

  function switchEditorMode() {
    if (editorMode === "visual") {
      setHtmlSource(syncEditor());
      setEditorMode("html");
      return;
    }

    if (editorRef.current) {
      editorRef.current.innerHTML = htmlSource.trim() || "<p><br></p>";
    }
    syncEditor();
    setEditorMode("visual");
  }

  function insertImage(url: string, alt: string) {
    restoreSelection();
    const editor = editorRef.current;
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    const paragraph = document.createElement("p");

    image.src = url;
    image.alt = alt;
    figure.append(image);
    paragraph.innerHTML = "<br>";

    const selection = window.getSelection();
    const rangeIsInsideEditor =
      selection?.rangeCount &&
      editor?.contains(selection.getRangeAt(0).commonAncestorContainer);

    function isEmptyParagraph(node: Node | null): node is HTMLParagraphElement {
      return (
        node instanceof HTMLParagraphElement &&
        !node.textContent?.trim() &&
        Array.from(node.childNodes).every((child) => child.nodeName === "BR")
      );
    }

    function moveCaretToParagraph() {
      const nextRange = document.createRange();
      nextRange.setStart(paragraph, 0);
      nextRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();
    }

    if (rangeIsInsideEditor) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const currentBlock = topLevelEditorNode(range.startContainer);
      if (isEmptyParagraph(currentBlock)) {
        currentBlock.replaceWith(figure, paragraph);
      } else if (currentBlock) {
        currentBlock.after(figure, paragraph);
      } else {
        editor?.append(figure, paragraph);
      }
      moveCaretToParagraph();
    } else {
      editor?.append(figure, paragraph);
    }

    syncEditor();
    return image;
  }

  function selectedEditorText() {
    return savedRangeRef.current?.toString().replace(/\s+/g, " ").trim() ?? "";
  }

  function openLinkEditor() {
    setLinkUrl("");
    setLinkLabel(selectedEditorText());
    setLinkError("");
    setLinkEditorOpen(true);
  }

  function parseLinkUrl(value: string) {
    const input = value.trim();
    if (!input) {
      return null;
    }

    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  }

  function insertLinkPreview(url: URL, label: string) {
    restoreSelection();

    const editor = editorRef.current;
    const preview = document.createElement("figure");
    const anchor = document.createElement("a");
    const type = document.createElement("span");
    const title = document.createElement("strong");
    const hostname = document.createElement("span");
    const paragraph = document.createElement("p");

    preview.className = "wp-block-yooreru-link-preview";
    preview.contentEditable = "false";
    anchor.href = url.href;
    anchor.target = "_blank";
    anchor.rel = "noreferrer noopener";
    type.className = "yooreru-link-preview-type";
    type.textContent = "LINK";
    title.className = "yooreru-link-preview-title";
    title.textContent = label || url.hostname.replace(/^www\./, "");
    hostname.className = "yooreru-link-preview-url";
    hostname.textContent = url.href;
    paragraph.innerHTML = "<br>";
    anchor.append(type, title, hostname);
    preview.append(anchor);

    const selection = window.getSelection();
    const rangeIsInsideEditor =
      selection?.rangeCount &&
      editor?.contains(selection.getRangeAt(0).commonAncestorContainer);

    function isEmptyParagraph(node: Node | null): node is HTMLParagraphElement {
      return (
        node instanceof HTMLParagraphElement &&
        !node.textContent?.trim() &&
        Array.from(node.childNodes).every((child) => child.nodeName === "BR")
      );
    }

    function moveCaretToParagraph() {
      const nextRange = document.createRange();
      nextRange.setStart(paragraph, 0);
      nextRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();
    }

    if (rangeIsInsideEditor) {
      const range = selection.getRangeAt(0);
      const currentBlock = topLevelEditorNode(range.startContainer);
      range.deleteContents();
      if (isEmptyParagraph(currentBlock)) {
        currentBlock.replaceWith(preview, paragraph);
      } else if (currentBlock) {
        currentBlock.after(preview, paragraph);
      } else {
        editor?.append(preview, paragraph);
      }
      moveCaretToParagraph();
    } else {
      editor?.append(preview, paragraph);
    }

    syncEditor();
  }

  function submitLinkPreview() {
    let url: URL | null = null;
    try {
      url = parseLinkUrl(linkUrl);
    } catch {
      // Invalid URLs are handled below.
    }

    if (!url) {
      setLinkError("http:// 또는 https:// 주소를 입력해 주세요.");
      return;
    }

    insertLinkPreview(url, linkLabel.trim());
    setLinkEditorOpen(false);
    setLinkUrl("");
    setLinkLabel("");
    setLinkError("");
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    setUploadingImage(true);
    setUploadError("");
    const previewUrl = URL.createObjectURL(file);
    const previewImage = insertImage(previewUrl, file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploaded = await uploadEditorImage(formData);
      previewImage.src = uploaded.url;
      previewImage.dataset.blobPathname = uploaded.pathname;
      URL.revokeObjectURL(previewUrl);
      syncEditor();
    } catch (error) {
      try {
        previewImage.src = await readImageDataUrl(file);
        syncEditor();
      } catch {
        // Keep the object URL preview if FileReader cannot produce a data URL.
      }
      const message = error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.";
      if (message.includes("BLOB_READ_WRITE_TOKEN")) {
        setUploadError("Blob 토큰이 없어 로컬 미리보기용 이미지로 삽입했습니다. 배포 환경에서는 BLOB_READ_WRITE_TOKEN을 설정해 주세요.");
      } else {
        setUploadError(message);
      }
    } finally {
      setUploadingImage(false);
    }
  }

  const runAutosave = useCallback(async () => {
    if (!autosaveAllowed || uploadingImage || autosaveInFlightRef.current || !formRef.current) {
      return;
    }

    syncActiveEditor();
    const formData = new FormData(formRef.current);
    if (postId) {
      formData.set("id", String(postId));
    }

    if (String(formData.get("status") ?? "") !== "DRAFT") {
      return;
    }

    const title = String(formData.get("title") ?? "").trim();
    const contentHtml = String(formData.get("contentHtml") ?? "").trim();
    if (!hasAutosaveContent(title, contentHtml)) {
      return;
    }

    const snapshot = createAutosaveFingerprint(formData);
    if (snapshot === lastAutosaveSnapshotRef.current) {
      return;
    }

    autosaveInFlightRef.current = true;
    setAutosaving(true);
    setAutosaveError("");

    try {
      const result = await autosavePost(formData);
      if (result.skipped) {
        return;
      }

      if (result.id !== postId) {
        formData.set("id", String(result.id));
        setPostId(result.id);
        if (window.location.pathname === "/admin/posts/new") {
          window.history.replaceState(null, "", `/admin/posts/${result.id}/edit`);
        }
      }
      lastAutosaveSnapshotRef.current = createAutosaveFingerprint(formData);
      setAutosaveStatus(`${formatAutosaveTime(result.savedAt)} 임시 저장됨`);
    } catch (error) {
      setAutosaveError(error instanceof Error ? error.message : "자동 임시 저장에 실패했습니다.");
    } finally {
      autosaveInFlightRef.current = false;
      setAutosaving(false);
    }
  }, [autosaveAllowed, postId, syncActiveEditor, uploadingImage]);

  useEffect(() => {
    if (!autosaveAllowed) {
      return;
    }

    const timer = window.setInterval(() => {
      void runAutosave();
    }, AUTOSAVE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [autosaveAllowed, runAutosave]);

  useEffect(() => {
    if (linkEditorOpen) {
      linkUrlInputRef.current?.focus();
    }
  }, [linkEditorOpen]);

  return (
    <form ref={formRef} className="admin-panel editor-form" action={savePost}>
      {postId ? <input type="hidden" name="id" value={postId} /> : null}
      <input ref={contentInputRef} type="hidden" name="contentHtml" defaultValue={initialContentHtml} />

      <label>
        제목
        <input name="title" required defaultValue={post?.title ?? ""} />
      </label>
      <label>
        슬러그
        <input name="slug" defaultValue={post?.slug ?? ""} placeholder="비워두면 제목으로 생성" />
      </label>

      <div className="admin-editor-shell">
        <div className="admin-editor-toolbar" aria-label="본문 도구">
          <div className="admin-font-control">
            <ALargeSmall size={20} aria-hidden="true" />
            <select
              aria-label="본문 글꼴"
              defaultValue=""
              disabled={editorMode === "html"}
              onMouseDown={saveSelection}
              onChange={(event) => {
                applyFontClass(event.currentTarget.value as EditorFontClass);
                event.currentTarget.value = "";
              }}
            >
              {FONT_OPTIONS.map((option) => (
                <option key={option.label} value={option.className}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-font-control">
            <span aria-hidden="true">가</span>
            <select
              aria-label="본문 글자 크기"
              defaultValue=""
              disabled={editorMode === "html"}
              onMouseDown={saveSelection}
              onChange={(event) => {
                applyFontSizeClass(event.currentTarget.value as EditorFontSizeClass);
                event.currentTarget.value = "";
              }}
            >
              {FONT_SIZE_OPTIONS.map((option) => (
                <option key={option.label} value={option.className}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            title="이미지 삽입"
            disabled={uploadingImage || editorMode === "html"}
            onMouseDown={(event) => {
              event.preventDefault();
              saveSelection();
            }}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlus size={22} />
          </button>
          <button
            type="button"
            title="링크 미리보기 삽입"
            disabled={editorMode === "html"}
            onMouseDown={(event) => {
              event.preventDefault();
              saveSelection();
            }}
            onClick={openLinkEditor}
          >
            <Link2 size={22} />
            <span className="screen-reader-text">링크 미리보기 삽입</span>
          </button>
          <button
            type="button"
            title={editorMode === "visual" ? "HTML 직접 편집" : "비주얼 편집으로 돌아가기"}
            aria-pressed={editorMode === "html"}
            onClick={switchEditorMode}
          >
            <CodeXml size={22} />
            <span className="screen-reader-text">{editorMode === "visual" ? "HTML 직접 편집" : "비주얼 편집으로 돌아가기"}</span>
          </button>
          <input
            ref={imageInputRef}
            className="admin-image-input"
            type="file"
            accept="image/*"
            hidden
            tabIndex={-1}
            onChange={handleImageChange}
          />
        </div>
        {linkEditorOpen ? (
          <div className="admin-link-editor" aria-label="링크 미리보기 삽입">
            <label>
              URL
              <input
                ref={linkUrlInputRef}
                type="text"
                inputMode="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(event) => {
                  setLinkUrl(event.currentTarget.value);
                  setLinkError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitLinkPreview();
                  }
                }}
              />
            </label>
            <label>
              표시 문구
              <input
                type="text"
                placeholder="비워두면 사이트 주소를 표시합니다"
                value={linkLabel}
                onChange={(event) => setLinkLabel(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitLinkPreview();
                  }
                }}
              />
            </label>
            <div className="admin-link-editor-actions">
              <button type="button" onClick={submitLinkPreview}>
                삽입
              </button>
              <button
                type="button"
                className="admin-link-editor-cancel"
                onClick={() => {
                  setLinkEditorOpen(false);
                  setLinkError("");
                }}
              >
                취소
              </button>
            </div>
            {linkError ? <p className="admin-editor-error">{linkError}</p> : null}
          </div>
        ) : null}
        {uploadError ? <p className="admin-editor-error">{uploadError}</p> : null}
        {uploadingImage ? <p className="admin-editor-status">이미지를 업로드하고 있습니다.</p> : null}
        {autosaveError ? <p className="admin-editor-error">{autosaveError}</p> : null}
        {autosaving ? <p className="admin-editor-status">임시 저장 중입니다.</p> : null}
        {autosaveStatus ? <p className="admin-editor-status">{autosaveStatus}</p> : null}
        <div
          ref={setEditorNode}
          className="admin-rich-editor"
          contentEditable
          hidden={editorMode === "html"}
          suppressContentEditableWarning
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          onFocus={saveSelection}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
            syncEditor();
          }}
          onInput={() => {
            if (!isComposingRef.current) {
              syncEditor();
            }
          }}
          onBlur={syncEditor}
        />
        {editorMode === "html" ? (
          <textarea
            className="admin-html-editor"
            aria-label="본문 HTML"
            spellCheck={false}
            value={htmlSource}
            onChange={(event) => {
              setHtmlSource(event.currentTarget.value);
              if (contentInputRef.current) {
                contentInputRef.current.value = event.currentTarget.value.trim() || "<p><br></p>";
              }
            }}
          />
        ) : null}
      </div>

      <div className="form-grid">
        <label>
          상태
          <select name="status" defaultValue={post?.status ?? "DRAFT"}>
            <option value="DRAFT">초안</option>
            <option value="PUBLISHED">발행</option>
            <option value="SCHEDULED">예약</option>
          </select>
        </label>
        <label>
          발행일
          <input type="datetime-local" name="publishedAt" defaultValue={defaultPublishedAt} />
        </label>
      </div>

      <label>
        카테고리
        <select name="categoryId" defaultValue={defaultCategoryId}>
          <option value="">미분류</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {categoryLabel(category, categories)}
            </option>
          ))}
        </select>
      </label>

      <label>
        태그
        <input name="tags" defaultValue={post?.tags?.map((item) => item.name).join(", ") ?? ""} />
      </label>

      <div className="check-row">
        <label>
          <input type="checkbox" name="allowComments" defaultChecked={post?.allowComments ?? true} />
          댓글 허용
        </label>
        <label>
          <input type="checkbox" name="notifySubscribers" defaultChecked={!post?.id} />
          발행 시 구독자에게 이메일 발송
        </label>
      </div>
      <button className="admin-button" type="submit" onClick={syncActiveEditor}>
        <Save size={16} />
        저장
      </button>
    </form>
  );
}
