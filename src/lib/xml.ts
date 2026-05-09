export function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function cdata(input: string) {
  return `<![CDATA[${input.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}
