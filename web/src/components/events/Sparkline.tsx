"use client";
import React, { useMemo } from 'react';

// Simplified type for table cell usage
interface SparklineProps {
    data: number[];
    prediction?: number[]; // Optional prediction line
    color?: string;
    predColor?: string;
    width?: number;
    height?: number;
}

export default function Sparkline({ data, prediction, color = '#33CCBB', predColor = '#f59e0b', width = 100, height = 30 }: SparklineProps) {
    // Combine data limits to scale both lines to same y-axis
    const allValues = [...data, ...(prediction || [])];
    const max = Math.max(...allValues);
    const min = Math.min(...allValues);
    const range = max - min || 1;

    const getPath = (points: number[]) => {
        if (!points || points.length < 2) return '';
        return points.map((val, i) => {
            const x = (i / (points.length - 1)) * width;
            const y = height - ((val - min) / range) * height;
            return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
        }).join(' ');
    };

    return (
        <svg width={width} height={height} className="overflow-visible">
            {/* Prediction Line */}
            {prediction && (
                <path
                    d={getPath(prediction)}
                    fill="none"
                    stroke={predColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="3 2"
                />
            )}
            {/* History Line */}
            <path
                d={getPath(data)}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
