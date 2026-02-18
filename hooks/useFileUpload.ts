'use client';

import { useState, useCallback } from 'react';
import { UploadedFile } from '@/context/SessionContext';
import { ToastKind } from './useToast';
import { mapApiFilesToUploadedFiles } from '@/lib/hookUtils';

export interface UseFileUploadReturn {
  files: UploadedFile[];
  isUploading: boolean;
  processFiles: (fileList: File[]) => Promise<void>;
  removeFile: (id: string) => void;
  handlePaste: (e: React.ClipboardEvent) => Promise<void>;
  clearFiles: () => void;
}

export function useFileUpload(
  showToast: (message: string, kind?: ToastKind) => void
): UseFileUploadReturn {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const processFiles = useCallback(async (fileList: File[]) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      fileList.forEach(file => formData.append('files', file));

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data: { files: Array<{ type: 'image' | 'pdf' | 'text'; content: string; name: string }> } = await response.json();
      const newFiles = mapApiFilesToUploadedFiles(data.files, Date.now()) as UploadedFile[];

      setFiles(prev => [...prev, ...newFiles]);
      showToast(`${newFiles.length > 1 ? newFiles.length + ' files' : '1 file'} uploaded`, 'success');
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  }, [showToast]);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await processFiles(imageFiles);
    }
  }, [processFiles]);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  return { files, isUploading, processFiles, removeFile, handlePaste, clearFiles };
}
