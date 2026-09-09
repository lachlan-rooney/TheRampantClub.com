import MarkdownIt from 'markdown-it'

// Document bodies are MARKDOWN, rendered with raw-HTML passthrough OFF.
//
// The alternative — storing HTML and defending it with a sanitiser — is defending
// a surface you chose to create. With html:false there is no surface: a stored
// `<script>` is escaped to text, and no javascript: href can be constructed. The
// injection question stops being a configuration you can get wrong.
const md = new MarkdownIt({ html: false, linkify: false, breaks: false })

export function renderDocument(markdown: string | null | undefined): string {
  return md.render(markdown || '')
}
