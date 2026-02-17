'use client';

import React, { useState, useEffect } from 'react';
import styles from './PasswordProtection.module.css';

interface PasswordProtectionProps {
    children: React.ReactNode;
}

const CORRECT_PASSWORD = 'woaini';
const STORAGE_KEY = 'supergpt_authenticated';

export default function PasswordProtection({ children }: PasswordProtectionProps) {
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);

    useEffect(() => {
        // Check if already authenticated
        const auth = localStorage.getItem(STORAGE_KEY);
        if (auth === 'true') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (password === CORRECT_PASSWORD) {
            localStorage.setItem(STORAGE_KEY, 'true');
            setIsAuthenticated(true);
            setError('');
        } else {
            setError('密码错误，请重试');
            setShake(true);
            setTimeout(() => setShake(false), 500);
            setPassword('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    if (isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.iconWrapper}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.icon}>
                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h1 className={styles.title}>IsabbY</h1>
                <p className={styles.subtitle}>请输入密码继续</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={`${styles.inputWrapper} ${shake ? styles.shake : ''}`}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="输入密码..."
                            className={styles.input}
                            autoFocus
                        />
                    </div>
                    {error && <p className={styles.error}>{error}</p>}
                    <button type="submit" className={styles.button}>
                        进入
                    </button>
                </form>

                <p className={styles.footer}>仅供宝贝使用哦</p>
            </div>
        </div>
    );
}
