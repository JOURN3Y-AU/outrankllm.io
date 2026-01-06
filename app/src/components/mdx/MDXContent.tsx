'use client'

import { MDXRemote } from 'next-mdx-remote'
import { serialize } from 'next-mdx-remote/serialize'
import { useEffect, useState } from 'react'
import type { MDXRemoteSerializeResult } from 'next-mdx-remote'
import remarkGfm from 'remark-gfm'

// Custom components for MDX
const components = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="text-2xl font-medium text-[var(--text)]"
      style={{ marginTop: '56px', marginBottom: '20px', letterSpacing: '-0.01em' }}
      {...props}
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className="text-xl font-medium text-[var(--text)]"
      style={{ marginTop: '40px', marginBottom: '16px' }}
      {...props}
    />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p
      className="text-[var(--text-mid)]"
      style={{ marginBottom: '24px', lineHeight: '1.8' }}
      {...props}
    />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="text-[var(--text-mid)]"
      style={{ marginBottom: '24px', paddingLeft: '24px', listStyleType: 'disc' }}
      {...props}
    />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className="text-[var(--text-mid)]"
      style={{ marginBottom: '24px', paddingLeft: '24px', listStyleType: 'decimal' }}
      {...props}
    />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li
      style={{ marginBottom: '12px', lineHeight: '1.7' }}
      {...props}
    />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-[var(--green)] hover:underline"
      {...props}
    />
  ),
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="text-[var(--text)] font-medium" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="text-[var(--text-mid)] font-mono text-sm"
      style={{
        marginBottom: '24px',
        paddingLeft: '24px',
        borderLeft: '2px solid var(--green)',
        background: 'var(--surface)',
        padding: '20px 24px',
        lineHeight: '1.8'
      }}
      {...props}
    />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code
      className="font-mono text-sm bg-[var(--surface)] text-[var(--green)] px-1.5 py-0.5 rounded"
      {...props}
    />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="font-mono text-sm bg-[var(--surface)] text-[var(--text-mid)] overflow-x-auto"
      style={{
        marginBottom: '24px',
        padding: '20px 24px',
        border: '1px solid var(--border)',
        lineHeight: '1.6'
      }}
      {...props}
    />
  ),
  hr: () => (
    <hr
      className="border-[var(--border)]"
      style={{ margin: '48px 0' }}
    />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div style={{ overflowX: 'auto', marginBottom: '32px', marginTop: '24px' }}>
      <table
        className="w-full text-sm"
        style={{ borderCollapse: 'collapse', border: '1px solid var(--border)' }}
        {...props}
      />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-[var(--surface)]" {...props} />
  ),
  tbody: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody {...props} />
  ),
  tr: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="border-b border-[var(--border)]" {...props} />
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="text-left font-mono text-xs uppercase tracking-wider text-[var(--text-dim)]"
      style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}
      {...props}
    />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td
      className="text-[var(--text-mid)]"
      style={{ padding: '14px 16px', borderRight: '1px solid var(--border)', lineHeight: '1.6' }}
      {...props}
    />
  ),
}

interface MDXContentProps {
  content: string
}

export function MDXContent({ content }: MDXContentProps) {
  const [mdxSource, setMdxSource] = useState<MDXRemoteSerializeResult | null>(null)

  useEffect(() => {
    serialize(content, {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
      },
    }).then(setMdxSource)
  }, [content])

  if (!mdxSource) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-[var(--surface)] rounded w-3/4" style={{ marginBottom: '16px' }} />
        <div className="h-4 bg-[var(--surface)] rounded w-full" style={{ marginBottom: '16px' }} />
        <div className="h-4 bg-[var(--surface)] rounded w-5/6" />
      </div>
    )
  }

  return (
    <div className="mdx-content">
      <MDXRemote {...mdxSource} components={components} />
    </div>
  )
}
