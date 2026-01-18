import React from 'react'

interface HighlightTextProps {
  text: string
  highlight: string
  className?: string
  highlightClassName?: string
}

export function HighlightText({ 
  text, 
  highlight, 
  className = '',
  highlightClassName = 'bg-yellow-200 dark:bg-yellow-500/30 text-foreground rounded-sm px-0.5'
}: HighlightTextProps) {
  if (!highlight.trim()) {
    return <span className={className}>{text}</span>
  }

  const regex = new RegExp(`(${escapeRegExp(highlight)})`, 'gi')
  const parts = text.split(regex)

  return (
    <span className={className}>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <mark key={index} className={highlightClassName}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </span>
  )
}

// Helper to escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
