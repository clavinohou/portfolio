import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { publicUrl } from '../utils/publicUrl'
import { SpreadsheetLink } from './SpreadsheetLink'

function MarkdownLink({ node, ...props }) {
  const href = props.href ? publicUrl(String(props.href)) : undefined
  const linkProps = { ...props, href, className: 'markdown-link' }

  if (/^\/uploads\/[^?#]+\.xlsx(?:[?#]|$)/i.test(props.href ?? '')) {
    return <SpreadsheetLink {...linkProps} />
  }

  return <a {...linkProps} target="_blank" rel="noopener noreferrer" />
}

export function MarkdownBlock({ markdown, className = '' }) {
  const value = typeof markdown === 'string' ? markdown : ''

  return (
    <div className={`markdown-block ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{ a: MarkdownLink }}>
        {value}
      </ReactMarkdown>
    </div>
  )
}
