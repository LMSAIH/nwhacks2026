import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  return (
    <div className={`markdown-preview prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom heading styles
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold border-b border-border pb-2 mb-4">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-semibold border-b border-border/50 pb-1.5 mb-3 mt-6">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold mb-2 mt-5">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-medium mb-2 mt-4">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-base font-medium mb-1 mt-3">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-sm font-medium mb-1 mt-3 text-muted-foreground">{children}</h6>
          ),
          // Paragraphs
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed">{children}</p>
          ),
          // Links
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          ),
          // Code
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !className?.includes('language-')
            
            if (isInline) {
              return (
                <code 
                  className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-primary"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            
            return (
              <code className={`${className} block`} {...props}>
                {children}
              </code>
            )
          },
          // Code blocks
          pre: ({ children }) => (
            <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto my-4 text-sm">
              {children}
            </pre>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/50 pl-4 py-1 my-4 italic text-muted-foreground bg-muted/20 rounded-r">
              {children}
            </blockquote>
          ),
          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>
          ),
          li: ({ children, className }) => {
            // Handle task list items
            if (className?.includes('task-list-item')) {
              return <li className="list-none flex items-start gap-2">{children}</li>
            }
            return <li className="mb-1">{children}</li>
          },
          // Task list checkboxes
          input: ({ type, checked, disabled }) => {
            if (type === 'checkbox') {
              return (
                <input 
                  type="checkbox" 
                  checked={checked} 
                  disabled={disabled}
                  className="mr-2 mt-1 h-4 w-4 rounded border-border"
                  readOnly
                />
              )
            }
            return <input type={type} />
          },
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-border rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-border px-4 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-4 py-2">{children}</td>
          ),
          // Horizontal rule
          hr: () => (
            <hr className="my-6 border-border" />
          ),
          // Images
          img: ({ src, alt }) => (
            <img 
              src={src} 
              alt={alt} 
              className="max-w-full h-auto rounded-lg my-4 border border-border"
            />
          ),
          // Strong and emphasis
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          // Strikethrough
          del: ({ children }) => (
            <del className="line-through text-muted-foreground">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
