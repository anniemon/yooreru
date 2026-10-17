"use client";

import { useId, useRef, useState } from "react";

export function CommentForm({
  action,
  compact = false,
}: {
  action: (formData: FormData) => Promise<void>;
  compact?: boolean;
}) {
  const fieldId = useId();
  const submittingRef = useRef(false);
  const [valid, setValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function isValid(form: HTMLFormElement) {
    const name = form.elements.namedItem("authorName") as HTMLInputElement;
    const email = form.elements.namedItem("authorEmail") as HTMLInputElement;
    const content = form.elements.namedItem("content") as HTMLTextAreaElement;
    return Boolean(name.value.trim() && content.value.trim()) &&
      name.validity.valid && email.validity.valid && content.validity.valid;
  }

  return (
    <form
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
      <p className="form-submit">
        <button type="submit" disabled={!valid || submitting} aria-live="polite">
          {submitting ? "Submitting…" : compact ? "Reply" : "Comment"}
        </button>
      </p>
    </form>
  );
}
