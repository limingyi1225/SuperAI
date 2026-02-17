'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import styles from './FileUploader.module.css';

interface UploadedFile {
    id: string;
    type: 'image' | 'pdf' | 'text';
    content: string;
    name: string;
    preview?: string;
}

interface FileUploaderProps {
    files: UploadedFile[];
    onFilesChange: (files: UploadedFile[]) => void;
    disabled?: boolean;
}

interface UploadApiFile {
    type: UploadedFile['type'];
    content: string;
    name: string;
}

interface UploadApiResponse {
    files: UploadApiFile[];
}

export default function FileUploader({ files, onFilesChange, disabled }: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;

        const droppedFiles = Array.from(e.dataTransfer.files);
        await processFiles(droppedFiles);
    };

    const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && !disabled) {
            const selectedFiles = Array.from(e.target.files);
            await processFiles(selectedFiles);
        }
    };

    const processFiles = async (fileList: File[]) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            fileList.forEach(file => formData.append('files', file));

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');

            const data = (await response.json()) as UploadApiResponse;
            const newFiles: UploadedFile[] = data.files.map((f, i) => ({
                id: `${Date.now()}-${i}`,
                type: f.type,
                content: f.content,
                name: f.name,
                preview: f.type === 'image' ? f.content : undefined,
            }));

            onFilesChange([...files, ...newFiles]);
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const removeFile = (id: string) => {
        onFilesChange(files.filter(f => f.id !== id));
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
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
    };

    return (
        <div className={styles.container} onPaste={handlePaste}>
            <div
                className={`${styles.dropzone} ${isDragging ? styles.dragging : ''} ${disabled ? styles.disabled : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !disabled && fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    accept="image/*,.pdf,.txt"
                    className={styles.hiddenInput}
                    disabled={disabled}
                />

                {isUploading ? (
                    <div className={styles.uploading}>
                        <div className={styles.spinner}></div>
                        <span>Uploading...</span>
                    </div>
                ) : (
                    <div className={styles.dropzoneContent}>
                        <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        <p>Drag & drop files here, or click to select</p>
                        <span className={styles.hint}>Supports PDF, images, and text files. You can also paste images.</span>
                    </div>
                )}
            </div>

            {files.length > 0 && (
                <div className={styles.fileList}>
                    {files.map(file => (
                        <div key={file.id} className={styles.fileItem}>
                            {file.preview ? (
                                <img src={file.preview} alt={file.name} className={styles.preview} />
                            ) : (
                                <div className={styles.fileIcon}>
                                    {file.type === 'pdf' ? '📄' : '📝'}
                                </div>
                            )}
                            <span className={styles.fileName}>{file.name}</span>
                            <button
                                className={styles.removeBtn}
                                onClick={() => removeFile(file.id)}
                                disabled={disabled}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
