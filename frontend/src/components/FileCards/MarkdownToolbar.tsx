import { 
  Bold, 
  Italic, 
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Minus,
  CheckSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MarkdownAction {
  icon: React.ElementType
  label: string
  prefix: string
  suffix: string
  block?: boolean
}

const markdownActions: MarkdownAction[] = [
  { icon: Heading1, label: 'Heading 1', prefix: '# ', suffix: '', block: true },
  { icon: Heading2, label: 'Heading 2', prefix: '## ', suffix: '', block: true },
  { icon: Heading3, label: 'Heading 3', prefix: '### ', suffix: '', block: true },
  { icon: Bold, label: 'Bold', prefix: '**', suffix: '**' },
  { icon: Italic, label: 'Italic', prefix: '_', suffix: '_' },
  { icon: Strikethrough, label: 'Strikethrough', prefix: '~~', suffix: '~~' },
  { icon: Code, label: 'Inline Code', prefix: '`', suffix: '`' },
  { icon: Quote, label: 'Quote', prefix: '> ', suffix: '', block: true },
  { icon: List, label: 'Bullet List', prefix: '- ', suffix: '', block: true },
  { icon: ListOrdered, label: 'Numbered List', prefix: '1. ', suffix: '', block: true },
  { icon: CheckSquare, label: 'Task List', prefix: '- [ ] ', suffix: '', block: true },
  { icon: Link, label: 'Link', prefix: '[', suffix: '](url)' },
  { icon: Image, label: 'Image', prefix: '![alt](', suffix: ')' },
  { icon: Minus, label: 'Horizontal Rule', prefix: '\n---\n', suffix: '', block: true },
]

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  content: string
  onContentChange: (content: string) => void
  disabled?: boolean
}

export function MarkdownToolbar({ 
  textareaRef, 
  content, 
  onContentChange,
  disabled 
}: MarkdownToolbarProps) {
  
  const applyFormatting = (action: MarkdownAction) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    
    let newContent: string
    let newCursorPos: number

    if (action.block) {
      // For block-level elements, ensure we're at the start of a line
      const beforeSelection = content.substring(0, start)
      const afterSelection = content.substring(end)
      const lineStart = beforeSelection.lastIndexOf('\n') + 1
      const textBeforeLine = content.substring(0, lineStart)
      const currentLine = beforeSelection.substring(lineStart)
      
      if (selectedText) {
        // Wrap selected text
        newContent = textBeforeLine + action.prefix + currentLine + selectedText + action.suffix + afterSelection
        newCursorPos = start + action.prefix.length + selectedText.length
      } else {
        // Just insert the prefix
        newContent = content.substring(0, start) + action.prefix + action.suffix + content.substring(end)
        newCursorPos = start + action.prefix.length
      }
    } else {
      // For inline elements
      if (selectedText) {
        newContent = content.substring(0, start) + action.prefix + selectedText + action.suffix + content.substring(end)
        newCursorPos = start + action.prefix.length + selectedText.length + action.suffix.length
      } else {
        newContent = content.substring(0, start) + action.prefix + action.suffix + content.substring(end)
        newCursorPos = start + action.prefix.length
      }
    }

    onContentChange(newContent)
    
    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const insertCodeBlock = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    
    const codeBlock = selectedText 
      ? `\n\`\`\`\n${selectedText}\n\`\`\`\n`
      : '\n```\n\n```\n'
    
    const newContent = content.substring(0, start) + codeBlock + content.substring(end)
    onContentChange(newContent)

    setTimeout(() => {
      textarea.focus()
      const cursorPos = selectedText 
        ? start + codeBlock.length 
        : start + 5 // Position inside the code block
      textarea.setSelectionRange(cursorPos, cursorPos)
    }, 0)
  }

  // Group actions for better organization
  const headings = markdownActions.slice(0, 3)
  const textFormatting = markdownActions.slice(3, 7)
  const lists = markdownActions.slice(7, 11)
  const other = markdownActions.slice(11)

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border/50 bg-muted/30 overflow-x-auto">
      {/* Headings */}
      <div className="flex items-center gap-0.5">
        {headings.map((action) => (
          <Button
            key={action.label}
            size="icon"
            variant="ghost"
            onClick={() => applyFormatting(action)}
            disabled={disabled}
            className="h-8 w-8 hover:bg-primary/10"
            title={action.label}
          >
            <action.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Text Formatting */}
      <div className="flex items-center gap-0.5">
        {textFormatting.map((action) => (
          <Button
            key={action.label}
            size="icon"
            variant="ghost"
            onClick={() => applyFormatting(action)}
            disabled={disabled}
            className="h-8 w-8 hover:bg-primary/10"
            title={action.label}
          >
            <action.icon className="h-4 w-4" />
          </Button>
        ))}
        {/* Code Block Button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={insertCodeBlock}
          disabled={disabled}
          className="h-8 w-8 hover:bg-primary/10"
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Lists */}
      <div className="flex items-center gap-0.5">
        {lists.map((action) => (
          <Button
            key={action.label}
            size="icon"
            variant="ghost"
            onClick={() => applyFormatting(action)}
            disabled={disabled}
            className="h-8 w-8 hover:bg-primary/10"
            title={action.label}
          >
            <action.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Other */}
      <div className="flex items-center gap-0.5">
        {other.map((action) => (
          <Button
            key={action.label}
            size="icon"
            variant="ghost"
            onClick={() => applyFormatting(action)}
            disabled={disabled}
            className="h-8 w-8 hover:bg-primary/10"
            title={action.label}
          >
            <action.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
    </div>
  )
}
