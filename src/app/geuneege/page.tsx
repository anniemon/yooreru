import Link from "next/link";
import { sendContactMessage } from "@/app/actions";
import { SiteHeader } from "@/components/site";

export const dynamic = "force-dynamic";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <>
      <div className="wp-block-template-part">
        <SiteHeader />
      </div>
      <div style={{ height: "100px" }} aria-hidden="true" className="wp-block-spacer"></div>
      <div className="wp-block-group alignfull has-global-padding is-content-justification-center is-layout-constrained contact-shell">
        <div className="wp-block-spacer contact-shell-spacer" aria-hidden="true"></div>
        <div className="wp-block-columns alignwide is-layout-flex contact-columns">
          <div className="wp-block-column is-layout-flow contact-copy-column">
            <h5 className="wp-block-heading has-text-align-left has-secondary-color has-text-color has-link-color has-large-font-size">
              from______
            </h5>
            <div style={{ height: "var(--wp--preset--spacing--10)" }} aria-hidden="true" className="wp-block-spacer"></div>
            <p className="has-primary-color has-text-color has-link-color has-cabin-font-family has-small-font-size wp-block-paragraph contact-copy">
              오늘 하고 싶은 얘기 있어? 아무 말이나 좋아.
            </p>
          </div>
          <div className="wp-block-column has-secondary-color has-text-color has-link-color has-cabin-font-family has-small-font-size has-global-padding is-layout-constrained contact-form-column">
            {sent === "1" ? (
              <div className="jetpack-contact-form-container contact-success-shell">
                <div className="contact-form-submission contact-form-ajax-submission submission-success" tabIndex={-1}>
                  <p className="go-back-message">
                    <Link className="link" href="/%EA%B7%B8%EB%84%A4%EC%97%90%EA%B2%8C/">
                      ← Back
                    </Link>
                  </p>
                  <h4>Thank you for your response. ✨</h4>
                </div>
              </div>
            ) : (
              <form
                action={sendContactMessage}
                className="contact-form commentsblock jetpack-contact-form__form has-no-jetpack-form-layout"
                aria-label="그네에게"
              >
                <input className="hp" type="text" name="company" tabIndex={-1} autoComplete="off" />
                <div className="wp-block-jetpack-contact-form is-style-default has-primary-color has-text-color has-link-color is-layout-flex">
                  <div className="wp-block-jetpack-field-name grunion-field-name-wrap wp-block-jetpack-input-wrap has-border-color-wrap grunion-field-wrap">
                    <label className="grunion-field-label name wp-block-jetpack-label" htmlFor="contact-name">
                      Name<span className="grunion-label-required" aria-hidden="true">(required)</span>
                    </label>
                    <input
                      className="name wp-block-jetpack-input has-border-color grunion-field"
                      id="contact-name"
                      name="senderName"
                      type="text"
                      placeholder="식별할 수 있는 이름/닉네임을 적어주세요"
                      required
                      maxLength={80}
                    />
                  </div>
                  <div className="wp-block-jetpack-field-email grunion-field-email-wrap wp-block-jetpack-input-wrap has-border-color-wrap grunion-field-wrap">
                    <label className="grunion-field-label email wp-block-jetpack-label" htmlFor="contact-email">
                      Email
                    </label>
                    <input
                      className="email wp-block-jetpack-input has-border-color grunion-field"
                      id="contact-email"
                      name="senderEmail"
                      type="email"
                      placeholder="원하신다면 메일 주소를 남겨주세요"
                      maxLength={160}
                      required
                    />
                  </div>
                  <div className="wp-block-jetpack-field-textarea grunion-field-textarea-wrap wp-block-jetpack-input-wrap has-border-color-wrap grunion-field-wrap">
                    <label className="grunion-field-label textarea wp-block-jetpack-label" htmlFor="contact-message">
                      Message<span className="grunion-label-required" aria-hidden="true">(required)</span>
                    </label>
                    <textarea
                      className="textarea wp-block-jetpack-input has-border-color grunion-field"
                      id="contact-message"
                      name="message"
                      placeholder="하고 싶은 말"
                      rows={20}
                      maxLength={4000}
                      required
                    />
                  </div>
                </div>
                <p className="contact-submit">
                  <button type="submit" className="pushbutton-wide">
                    Submit
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
      <div style={{ height: "150px" }} aria-hidden="true" className="wp-block-spacer"></div>
    </>
  );
}
