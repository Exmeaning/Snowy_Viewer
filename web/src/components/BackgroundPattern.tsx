"use client";
import React from 'react';
import styles from '../app/components/BackgroundPattern.module.css';
import { useTheme } from '@/contexts/ThemeContext';

const BackgroundPattern = () => {
    const { isPowerSaving } = useTheme();
    // Create an array for the 30 rows
    const rows = Array.from({ length: 30 }, (_, i) => i + 1);
    return (
        <div className={styles.bgPatternContainer}>
            <div className={styles.rotatedWrapper}>
                {rows.map((n) => (
                    <div
                        key={n}
                        className={`${styles.patternRow} ${n % 2 === 0 ? styles.reverse : ''} ${isPowerSaving ? styles.static : ''}`}
                    />
                ))}
            </div>
        </div>
    );
};
export default BackgroundPattern;
