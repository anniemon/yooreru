"use client";

import { useActionState, useState } from "react";
import { subscribe, type SubscribeState } from "@/app/actions";

const initialState: SubscribeState = {
  ok: false,
  message: "",
};

export function SubscribeForm() {
  const [state, formAction, pending] = useActionState(subscribe, initialState);
  const [dismissedMessage, setDismissedMessage] = useState("");
  const [formHidden, setFormHidden] = useState(false);
  const visibleMessage = state.message && state.message !== dismissedMessage ? state.message : "";

  if (formHidden) {
    return null;
  }

  function handleConfirm() {
    if (state.ok) {
      setFormHidden(true);
      return;
    }

    setDismissedMessage(visibleMessage);
  }

  return (
    <form className="footer-subscribe-form" action={formAction}>
      <label className="screen-reader-text" htmlFor="footer-subscribe-email">
        Email
      </label>
      <input
        id="footer-subscribe-email"
        name="email"
        type="email"
        placeholder="Enter your email address"
        required
      />
      <button type="submit" disabled={pending}>
        {pending ? "Submitting" : "Submit"}
      </button>
      {visibleMessage ? (
        <p className={`footer-subscribe-message ${state.ok ? "is-success" : "is-error"}`}>
          <span>{visibleMessage}</span>
          <button type="button" onClick={handleConfirm}>
            확인
          </button>
        </p>
      ) : null}
    </form>
  );
}
