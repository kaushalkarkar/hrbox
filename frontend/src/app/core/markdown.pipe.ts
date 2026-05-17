import { Pipe, PipeTransform } from '@angular/core';

/**
 * Tiny markdown renderer covering the subset we actually need for HR policies:
 * # / ## / ### headings, **bold**, *italic*, `code`, simple tables,
 * `-` and `1.` lists, blank-line paragraphs, single-line breaks within paragraphs.
 *
 * Output is meant to be passed through SafeHtmlPipe in a developer-controlled context.
 */
@Pipe({ name: 'mdLite', standalone: true, pure: true })
export class MarkdownLitePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return renderMd(value);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  } as Record<string, string>)[ch]!);
}

function inline(s: string): string {
  let out = escapeHtml(s);
  // Bold then italic to avoid stepping on each other
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, '$1<em>$2</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

function renderMd(md: string): string {
  // Normalize newlines
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === '') { i++; continue; }

    // Heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    // Table (header row | separator row | body rows)
    if (line.includes('|') && i + 1 < lines.length && /^[ |:\-]+$/.test(lines[i + 1])) {
      const header = splitRow(line);
      const sep = lines[i + 1];
      const align = splitRow(sep).map(c => {
        const trimmed = c.trim();
        if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
        if (trimmed.endsWith(':')) return 'right';
        return 'left';
      });
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        body.push(splitRow(lines[i]));
        i++;
      }
      out.push('<table class="md-table">');
      out.push('<thead><tr>' + header.map((c, idx) => `<th style="text-align:${align[idx] ?? 'left'}">${inline(c.trim())}</th>`).join('') + '</tr></thead>');
      out.push('<tbody>' + body.map(row =>
        '<tr>' + row.map((c, idx) => `<td style="text-align:${align[idx] ?? 'left'}">${inline(c.trim())}</td>`).join('') + '</tr>'
      ).join('') + '</tbody>');
      out.push('</table>');
      continue;
    }

    // Bullet list
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^\s*-\s+/, '')));
        i++;
      }
      out.push('<ul>' + items.map(it => `<li>${it}</li>`).join('') + '</ul>');
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^\s*\d+\.\s+/, '')));
        i++;
      }
      out.push('<ol>' + items.map(it => `<li>${it}</li>`).join('') + '</ol>');
      continue;
    }

    // Paragraph: accumulate until blank line or block boundary
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*-\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${buf.map(inline).join('<br/>')}</p>`);
  }

  return out.join('\n');
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|');
}
