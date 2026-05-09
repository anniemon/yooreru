import { BlogComment, BlogPost } from "@/lib/sample-data";
import { createComment } from "@/app/actions";
import { getAppTimeZone } from "@/lib/time-zone";

function formatCommentTimestamp(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: getAppTimeZone(),
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function avatarUrl(comment: BlogComment) {
  if (!comment.authorEmailHash) {
    return null;
  }

  return `https://www.gravatar.com/avatar/${comment.authorEmailHash}?s=80&d=mp`;
}

function CommentForm({
  action,
  compact = false,
}: {
  action: (formData: FormData) => Promise<void>;
  compact?: boolean;
}) {
  return (
    <form action={action} id={compact ? undefined : "commentform"} className="comment-form">
      <input className="hp" type="text" name="company" tabIndex={-1} autoComplete="off" />
      <p className="comment-form-comment">
        <label htmlFor={compact ? "reply-content" : "comment"}>Comment</label>
        <textarea
          id={compact ? "reply-content" : "comment"}
          name="content"
          placeholder="Comment"
          rows={compact ? 4 : 8}
          maxLength={4000}
          required
        />
      </p>
      <p className="comment-form-author">
        <label htmlFor={compact ? "reply-authorName" : "author"}>Name</label>
        <input
          id={compact ? "reply-authorName" : "author"}
          name="authorName"
          type="text"
          maxLength={80}
          placeholder="Name"
          required
        />
      </p>
      <p className="comment-form-email">
        <label htmlFor={compact ? "reply-authorEmail" : "email"}>Email</label>
        <input
          id={compact ? "reply-authorEmail" : "email"}
          name="authorEmail"
          type="email"
          maxLength={160}
          placeholder="Email"
          autoComplete="email"
        />
      </p>
      <p className="form-submit">
        <button type="submit">{compact ? "Reply" : "Comment"}</button>
      </p>
    </form>
  );
}

function CommentNode({ comment, postId }: { comment: BlogComment; postId: number }) {
  const replyAction = createComment.bind(null, postId, comment.id);
  const imageSrc = avatarUrl(comment);

  return (
    <li className="comment">
      <article className="comment-body">
        <footer className="comment-meta">
          <div className="comment-author vcard">
            {imageSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                className="avatar avatar-80 photo"
                src={imageSrc}
                alt=""
                width="40"
                height="40"
              />
            ) : (
              <span className="avatar avatar-fallback" aria-hidden="true">
                {comment.authorName.slice(0, 1)}
              </span>
            )}
            <b className="fn">{comment.authorName}</b>
          </div>
          <div className="comment-metadata">
            <time dateTime={comment.createdAt.toISOString()}>{formatCommentTimestamp(comment.createdAt)}</time>
          </div>
        </footer>
        <div className="comment-content">
          <p>{comment.content}</p>
        </div>
        <div className="reply">
          <details className="comment-reply-details">
            <summary>Reply</summary>
            <CommentForm action={replyAction} compact />
          </details>
        </div>
      </article>
      {comment.children?.length ? (
        <ol className="children">
          {comment.children.map((child) => (
            <CommentNode key={child.id} comment={child} postId={postId} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function Comments({ post }: { post: BlogPost }) {
  const comments = post.comments ?? [];
  const action = createComment.bind(null, post.id, null);

  return (
    <div className="wp-block-group alignwide has-global-padding is-layout-constrained post-comments-shell">
      <div className="wp-block-columns alignwide is-layout-flex">
        <div className="wp-block-column is-layout-flow post-comments-column">
          <div className="wp-block-template-part">
            <div className="wp-block-group has-global-padding is-layout-constrained">
              <div className="wp-block-comments alignfull wp-block-comments-query-loop">
                {comments.length ? (
                  <ol className="commentlist">
                    {comments.map((comment) => (
                      <CommentNode key={comment.id} comment={comment} postId={post.id} />
                    ))}
                  </ol>
                ) : null}
                <div className="wp-block-group has-border-color has-secondary-border-color has-small-font-size has-global-padding is-layout-constrained comment-form-shell">
                  <div id="respond" className="comment-respond has-text-align-left has-link-color wp-block-post-comments-form has-text-color has-secondary-color has-background has-custom-color-3-background-color has-small-font-size">
                    <h3 id="reply-title" className="comment-reply-title">
                      {post.allowComments ? "Leave a comment" : "Comments are closed"}
                    </h3>
                    {post.allowComments ? (
                      <CommentForm action={action} />
                    ) : (
                      <p className="comments-closed-message">This post does not accept comments.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="wp-block-columns is-layout-flex">
            <div className="wp-block-column is-layout-flow">
              <div style={{ height: "20px" }} aria-hidden="true" className="wp-block-spacer"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
