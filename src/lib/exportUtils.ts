import { toPng, toSvg } from 'html-to-image';
import { Node, Edge } from 'reactflow';

/* ── JSON export / import ── */
export function exportJSON(nodes: Node[], edges: Edge[], fileName: string) {
  const data = JSON.stringify({ nodes, edges }, null, 2);
  downloadBlob(data, `${fileName}.json`, 'application/json');
}

export function importJSON(file: File): Promise<{ nodes: Node[]; edges: Edge[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve({ nodes: json.nodes ?? [], edges: json.edges ?? [] });
      } catch {
        reject(new Error('Invalid JSON'));
      }
    };
    reader.readAsText(file);
  });
}

/* ── Image export ── */
export async function exportPNG(element: HTMLElement, fileName: string) {
  const dataUrl = await toPng(element, {
    backgroundColor: '#0f0f0f',
    quality: 1,
    pixelRatio: 2,
  });
  downloadDataUrl(dataUrl, `${fileName}.png`);
}

export async function exportSVG(element: HTMLElement, fileName: string) {
  const dataUrl = await toSvg(element, { backgroundColor: '#0f0f0f' });
  downloadDataUrl(dataUrl, `${fileName}.svg`);
}

/* ── helpers ── */
function downloadBlob(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, name);
  URL.revokeObjectURL(url);
}

function downloadDataUrl(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
