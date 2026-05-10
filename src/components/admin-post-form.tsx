"use client";

import { useMemo, useRef, useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import { savePost, uploadEditorImage } from "@/app/admin/actions";
import type { AdminCategory } from "@/lib/admin-categories";
import { formatDateTimeLocal } from "@/lib/time-zone";

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

function categoryLabel(category: AdminCategory, categories: AdminCategory[]) {
  const parent = category.parentId ? categories.find((item) => item.id === category.parentId) : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

function readImageDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
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
  const editorRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const isComposingRef = useRef(false);
  const initializedContentRef = useRef(false);
  const initialContentHtml = useMemo(() => post?.contentHtml ?? "<p><br></p>", [post?.contentHtml]);
  const defaultPublishedAt = useMemo(
    () => formatDateTimeLocal(post?.publishedAt ?? (!post?.id ? new Date() : null), timeZone),
    [post?.id, post?.publishedAt, timeZone],
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const defaultCategoryId = useMemo(
    () =>
      String(
        post?.category?.id ??
          (!post?.id ? categories.find((category) => category.slug === "fingertip")?.id : "") ??
          "",
      ),
    [categories, post?.category?.id, post?.id],
  );

  function syncEditor() {
    if (contentInputRef.current) {
      contentInputRef.current.value = editorRef.current?.innerHTML.trim() || "<p><br></p>";
    }
  }

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

    function topLevelEditorNode(node: Node): ChildNode | null {
      if (!editor) {
        return null;
      }

      let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
      while (current?.parentNode && current.parentNode !== editor) {
        current = current.parentNode;
      }

      return current?.parentNode === editor ? (current as ChildNode) : null;
    }

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

  return (
    <form className="admin-panel editor-form" action={savePost}>
      {post?.id ? <input type="hidden" name="id" value={post.id} /> : null}
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
        <div className="admin-editor-toolbar" aria-label="본문 이미지 삽입">
          <button
            type="button"
            title="이미지 삽입"
            disabled={uploadingImage}
            onMouseDown={(event) => {
              event.preventDefault();
              saveSelection();
            }}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlus size={22} />
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
        {uploadError ? <p className="admin-editor-error">{uploadError}</p> : null}
        {uploadingImage ? <p className="admin-editor-status">이미지를 업로드하고 있습니다.</p> : null}
        <div
          ref={setEditorNode}
          className="admin-rich-editor"
          contentEditable
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
          {categories.map((category) => (
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
      <button className="admin-button" type="submit" onClick={syncEditor}>
        <Save size={16} />
        저장
      </button>
    </form>
  );
}
