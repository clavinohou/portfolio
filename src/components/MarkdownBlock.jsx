import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { publicUrl } from '../utils/publicUrl'

export function MarkdownBlock({ markdown, className = '' }) {
  const value = typeof markdown === 'string' ? markdown : ''

  return (
    <div className={`markdown-block ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a({ node, ...props }) {
            const href = props.href ? publicUrl(String(props.href)) : undefined
            return (
              <a
                {...props}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="markdown-link"
              />
            )
          },
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

