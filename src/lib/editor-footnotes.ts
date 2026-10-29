// Footnotes stay in contentHtml so drafts, HTML editing, and public posts share the same markup.
export function normalizeFootnotes(editor: HTMLElement) {
  const section = editor.querySelector<HTMLElement>(".yooreru-footnotes");
  if (!section) return;

  const list = section.querySelector("ol");
  if (!list) return;

  const notes = Array.from(list.querySelectorAll<HTMLLIElement>("li[id]"));
  const ordered: HTMLLIElement[] = [];
  editor.querySelectorAll<HTMLElement>("sup[data-footnote-id]").forEach((reference) => {
    const note = notes.find((item) => item.id === reference.dataset.footnoteId);
    const link = reference.querySelector("a");
    if (!note || !link) {
      reference.remove();
      return;
    }
    ordered.push(note);
    const number = String(ordered.length);
    reference.id = `${note.id}-ref`;
    reference.contentEditable = "false";
    link.setAttribute("href", `#${note.id}`);
    link.setAttribute("aria-label", `각주 ${number}`);
    if (link.textContent !== number) link.textContent = number;
    note.querySelector(".yooreru-footnote-backlink")?.setAttribute("aria-label", `본문 ${number}번 각주로 돌아가기`);
  });

  notes.filter((note) => !ordered.includes(note)).forEach((note) => note.remove());
  ordered.forEach((note, index) => {
    if (list.children[index] !== note) list.insertBefore(note, list.children[index] ?? null);
  });
  if (!ordered.length) section.remove();
}

export function insertFootnote(editor: HTMLElement, range: Range | null, text: string) {
  if (range && editor.contains(range.commonAncestorContainer)) {
    const element = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer as Element : range.endContainer.parentElement;
    if (element?.closest(".yooreru-footnotes, sup[data-footnote-id], a")) return null;
  } else {
    range = null;
  }

  const id = `footnote-${crypto.randomUUID()}`;
  const reference = document.createElement("sup");
  reference.dataset.footnoteId = id;
  reference.contentEditable = "false";
  const link = document.createElement("a");
  reference.append(link);

  let section = editor.querySelector<HTMLElement>(".yooreru-footnotes");
  if (!section) {
    section = document.createElement("section");
    section.className = "yooreru-footnotes";
    section.setAttribute("aria-label", "각주");
    section.append(document.createElement("ol"));
    editor.append(section);
  }
  const note = document.createElement("li");
  note.id = id;
  const content = document.createElement("span");
  content.className = "yooreru-footnote-text";
  content.textContent = text;
  const backlink = document.createElement("a");
  backlink.className = "yooreru-footnote-backlink";
  backlink.href = `#${id}-ref`;
  backlink.contentEditable = "false";
  backlink.textContent = "↩";
  note.append(content, document.createTextNode(" "), backlink);
  section.querySelector("ol")!.append(note);

  if (range) {
    // Keep selected words and place the reference immediately after them.
    range.collapse(false);
    range.insertNode(reference);
  } else {
    const paragraph = document.createElement("p");
    paragraph.append(reference);
    section.before(paragraph);
  }
  normalizeFootnotes(editor);
  const nextRange = document.createRange();
  nextRange.setStartAfter(reference);
  nextRange.collapse(true);
  return nextRange;
}
