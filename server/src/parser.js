import JSZip from 'jszip'
import * as cheerio from 'cheerio'

function summarizeHtml(html) {
  const $ = cheerio.load(html)
  const sections = [
    ...new Set(
      $('section, header, footer, nav, main, article, aside')
        .map((_, el) => $(el).prop('tagName')?.toLowerCase())
        .get()
        .filter(Boolean),
    ),
  ]

  const headings = $('h1,h2,h3')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 20)

  const colors = Array.from(html.matchAll(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)).map((m) => m[0])

  return {
    sections: sections.length ? sections : ['section', 'nav', 'footer'],
    headings,
    colors: [...new Set(colors)].slice(0, 16),
  }
}

function extractFigmaKey(url) {
  const m = url.match(/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/)
  return m?.[2] ?? null
}

function extractNodeId(url) {
  try {
    const u = new URL(url)
    const raw = u.searchParams.get('node-id')
    if (!raw) return null
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

function walkNode(node, out, depth = 0) {
  if (!node || depth > 6) return
  out.push({
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible !== false,
  })
  for (const ch of node.children ?? []) walkNode(ch, out, depth + 1)
}

async function fetchFigmaStructured(figmaUrl, token) {
  const fileKey = extractFigmaKey(figmaUrl)
  const nodeId = extractNodeId(figmaUrl)
  if (!fileKey) {
    return {
      type: 'figma',
      name: 'Invalid Figma URL',
      summary: { sections: ['figma-frame'], headings: ['Invalid URL'], colors: [] },
      meta: { figmaUrl, error: 'Unable to parse file key from URL' },
    }
  }

  if (!token) {
    return {
      type: 'figma',
      name: 'Figma Link (token missing)',
      summary: {
        sections: ['figma-frame', 'components', 'styles'],
        headings: ['Figma URL accepted, add FIGMA_TOKEN for deep fetch'],
        colors: [],
      },
      meta: { figmaUrl, fileKey, deepFetch: false, reason: 'Missing FIGMA_TOKEN' },
    }
  }

  const headers = { 'X-Figma-Token': token }
  const calls = [
    fetch(`https://api.figma.com/v1/files/${fileKey}`, { headers }),
    fetch(`https://api.figma.com/v1/files/${fileKey}/styles`, { headers }),
  ]
  if (nodeId) {
    calls.push(fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`, { headers }))
  }
  const [fileRes, stylesRes, nodeRes] = await Promise.all(calls)

  if (!fileRes.ok) {
    const err = await fileRes.text()
    return {
      type: 'figma',
      name: 'Figma Fetch Failed',
      summary: { sections: ['figma-frame'], headings: ['Figma API error'], colors: [] },
      meta: { figmaUrl, fileKey, deepFetch: false, error: err.slice(0, 400) },
    }
  }

  const fileJson = await fileRes.json()
  const stylesJson = stylesRes.ok ? await stylesRes.json() : { meta: { styles: [] } }
  const scopedJson = nodeRes?.ok ? await nodeRes.json() : null

  const nodes = []
  if (nodeId && scopedJson?.nodes?.[nodeId]?.document) {
    walkNode(scopedJson.nodes[nodeId].document, nodes)
  } else {
    for (const page of fileJson.document?.children ?? []) walkNode(page, nodes)
  }

  const frameLike = nodes.filter((n) => ['FRAME', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET'].includes(n.type))
  const topNodes = frameLike.slice(0, 200)

  const styles = (stylesJson.meta?.styles ?? []).slice(0, 500)
  const colorStyles = styles.filter((s) => s.styleType === 'FILL').map((s) => s.name)
  const textStyles = styles.filter((s) => s.styleType === 'TEXT').map((s) => s.name)

  return {
    type: 'figma',
    name: fileJson.name || 'Figma File',
    summary: {
      sections: [...new Set(topNodes.map((n) => n.type.toLowerCase()))].slice(0, 16),
      headings: topNodes.map((n) => n.name).filter(Boolean).slice(0, 40),
      colors: colorStyles.slice(0, 20),
    },
    meta: {
      figmaUrl,
      fileKey,
      nodeId,
      deepFetch: true,
      version: fileJson.version,
      lastModified: fileJson.lastModified,
      componentCount: topNodes.filter((n) => n.type === 'COMPONENT').length,
      componentSetCount: topNodes.filter((n) => n.type === 'COMPONENT_SET').length,
      frameCount: topNodes.filter((n) => n.type === 'FRAME').length,
      textStyles: textStyles.slice(0, 50),
      stylesCount: styles.length,
      sampledNodes: topNodes,
    },
  }
}

export async function parseTemplateUpload({ fileBuffer, originalName, figmaUrl, figmaToken }) {
  if (figmaUrl) {
    return fetchFigmaStructured(figmaUrl, figmaToken)
  }

  const name = (originalName || '').toLowerCase()

  if (name.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(fileBuffer)
    const entries = Object.keys(zip.files)
    const htmlFiles = entries.filter((e) => e.toLowerCase().endsWith('.html'))
    const cssFiles = entries.filter((e) => e.toLowerCase().endsWith('.css'))
    const imageFiles = entries.filter((e) => /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(e))

    let mergedHtml = ''
    for (const file of htmlFiles.slice(0, 5)) {
      mergedHtml += `\n` + (await zip.file(file)?.async('text'))
    }

    const summary = summarizeHtml(mergedHtml || '<section></section>')

    return {
      type: 'zip',
      name: originalName,
      summary,
      meta: {
        files: entries.length,
        htmlFiles: htmlFiles.length,
        cssFiles: cssFiles.length,
        imageFiles: imageFiles.length,
      },
    }
  }

  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const html = fileBuffer.toString('utf8')
    return {
      type: 'html',
      name: originalName,
      summary: summarizeHtml(html),
      meta: { bytes: fileBuffer.length },
    }
  }

  return {
    type: 'unknown',
    name: originalName || 'Unknown Upload',
    summary: {
      sections: ['generic-section'],
      headings: ['Unsupported file type: provide ZIP/HTML/Figma URL'],
      colors: [],
    },
    meta: {},
  }
}
