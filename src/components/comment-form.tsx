"use client";

import { useEffect, useId, useRef, useState } from "react";

const REMEMBERED_EMAIL_KEY = "yooreru.comment-email";

export function CommentForm({
  action,
  compact = false,
}: {
  action: (formData: FormData) => Promise<void>;
  compact?: boolean;
}) {
  const fieldId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [valid, setValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (!saved || saved.length > 160) return;
      const email = form.elements.namedItem("authorEmail") as HTMLInputElement;
      const remember = form.elements.namedItem("rememberEmail") as HTMLInputElement;
      email.value = saved;
      if (email.validity.valid) {
        email.defaultValue = saved;
        remember.checked = remember.defaultChecked = true;
      } else {
        email.value = "";
      }
    } catch {
      // Storage may be unavailable in private or in-app browsers.
    }
  }, []);

  function isValid(form: HTMLFormElement) {
    const name = form.elements.namedItem("authorName") as HTMLInputElement;
    const email = form.elements.namedItem("authorEmail") as HTMLInputElement;
    const content = form.elements.namedItem("content") as HTMLTextAreaElement;
    return Boolean(name.value.trim() && content.value.trim()) &&
      name.validity.valid && email.validity.valid && content.validity.valid;
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        try {
          await action(formData);
          setValid(false);
        } finally {
          submittingRef.current = false;
          setSubmitting(false);
        }
      }}
      id={compact ? undefined : "commentform"}
      className="comment-form"
      aria-busy={submitting}
      onChange={(event) => setValid(isValid(event.currentTarget))}
      onReset={() => setValid(false)}
      onSubmit={(event) => {
        if (submittingRef.current || !isValid(event.currentTarget)) {
          event.preventDefault();
          return;
        }
        const email = event.currentTarget.elements.namedItem("authorEmail") as HTMLInputElement;
        const remember = event.currentTarget.elements.namedItem("rememberEmail") as HTMLInputElement;
        const saved = remember.checked ? email.value.trim() : "";
        email.defaultValue = saved;
        remember.defaultChecked = Boolean(saved);
        try {
          if (saved) localStorage.setItem(REMEMBERED_EMAIL_KEY, saved);
          else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        } catch {
          // Remembering an email must not prevent comment submission.
        }
        submittingRef.current = true;
        setSubmitting(true);
      }}
    >
      <input className="hp" type="text" name="company" tabIndex={-1} autoComplete="off" />
      <p className="comment-form-comment">
        <label htmlFor={`${fieldId}-content`}>Comment</label>
        <textarea
          id={`${fieldId}-content`}
          name="content"
          placeholder="Comment"
          rows={compact ? 4 : 8}
          maxLength={4000}
          required
        />
      </p>
      <p className="comment-form-author">
        <label htmlFor={`${fieldId}-name`}>Name</label>
        <input
          id={`${fieldId}-name`}
          name="authorName"
          type="text"
          maxLength={80}
          placeholder="Name"
          required
        />
      </p>
      <p className="comment-form-email">
        <label htmlFor={`${fieldId}-email`}>Email</label>
        <input
          id={`${fieldId}-email`}
          name="authorEmail"
          type="email"
          maxLength={160}
          placeholder="Email (입력 시 댓글 알림 발송)"
          autoComplete="email"
        />
      </p>
      <p className="comment-form-remember">
        <input
          id={`${fieldId}-remember-email`}
          name="rememberEmail"
          type="checkbox"
          onChange={(event) => {
            if (event.currentTarget.checked) return;
            event.currentTarget.defaultChecked = false;
            const email = formRef.current?.elements.namedItem("authorEmail") as HTMLInputElement | null;
            if (email) email.defaultValue = "";
            try {
              localStorage.removeItem(REMEMBERED_EMAIL_KEY);
            } catch {
              // Storage restrictions must not block editing.
            }
          }}
        />
        <label htmlFor={`${fieldId}-remember-email`}>이 브라우저에 이메일 기억하기</label>
      </p>
      <p className="form-submit">
        <button type="submit" disabled={!valid || submitting} aria-live="polite">
          {submitting ? "Submitting…" : compact ? "Reply" : "Comment"}
        </button>
      </p>
    </form>
  );
}
