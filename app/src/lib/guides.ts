import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'

const guidesDirectory = path.join(process.cwd(), 'content/guides')

export interface GuideFrontmatter {
  title: string
  description: string
  category: string
  publishedAt: string
  updatedAt?: string
  author?: string
  keywords?: string[]
}

export interface Guide {
  slug: string
  frontmatter: GuideFrontmatter
  content: string
  readingTime: string
}

export interface GuideMeta {
  slug: string
  frontmatter: GuideFrontmatter
  readingTime: string
}

export function getGuideBySlug(slug: string): Guide | null {
  try {
    const fullPath = path.join(guidesDirectory, `${slug}.mdx`)
    const fileContents = fs.readFileSync(fullPath, 'utf8')
    const { data, content } = matter(fileContents)
    const stats = readingTime(content)

    return {
      slug,
      frontmatter: data as GuideFrontmatter,
      content,
      readingTime: stats.text,
    }
  } catch {
    return null
  }
}

export function getAllGuides(): GuideMeta[] {
  if (!fs.existsSync(guidesDirectory)) {
    return []
  }

  const fileNames = fs.readdirSync(guidesDirectory)
  const guides = fileNames
    .filter((fileName) => fileName.endsWith('.mdx'))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx$/, '')
      const fullPath = path.join(guidesDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      const { data, content } = matter(fileContents)
      const stats = readingTime(content)

      return {
        slug,
        frontmatter: data as GuideFrontmatter,
        readingTime: stats.text,
      }
    })
    .sort((a, b) => {
      // Sort by publishedAt date, newest first
      return new Date(b.frontmatter.publishedAt).getTime() - new Date(a.frontmatter.publishedAt).getTime()
    })

  return guides
}

export function getAllGuideSlugs(): string[] {
  if (!fs.existsSync(guidesDirectory)) {
    return []
  }

  const fileNames = fs.readdirSync(guidesDirectory)
  return fileNames
    .filter((fileName) => fileName.endsWith('.mdx'))
    .map((fileName) => fileName.replace(/\.mdx$/, ''))
}
