import { useCallback, useState } from 'react';

interface ExportOptions {
  width: number;
  projectName: string;
}

export function useExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPng = useCallback(async (elementId: string, options: ExportOptions) => {
    setExporting(true);
    setError(null);

    try {
      const element = document.getElementById(elementId);
      if (!element) throw new Error('Export element not found');

      // Dynamic import to reduce initial bundle
      const { domToPng } = await import('modern-screenshot');

      const dataUrl = await domToPng(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        style: {
          fontFamily: "-apple-system, 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
      });

      // Convert data URL to blob for size verification
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (blob.size <= 1024) {
        // Retry once
        const dataUrl2 = await domToPng(element, {
          scale: 2,
          backgroundColor: '#ffffff',
        });
        const res2 = await fetch(dataUrl2);
        const blob2 = await res2.blob();
        if (blob2.size <= 1024) {
          throw new Error('导出失败，请重试');
        }
        triggerDownload(dataUrl2, options.projectName);
      } else {
        triggerDownload(dataUrl, options.projectName);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }, []);

  return { exportPng, exporting, error };
}

function triggerDownload(dataUrl: string, projectName: string) {
  const safeName = projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, '_');
  const date = new Date().toISOString().slice(0, 10);
  const filename = `scope-shield-${safeName}-${date}.png`;

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
