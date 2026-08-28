"use client";
import React from 'react';

// Simplified type for table cell usage
interface SparklineProps {
    data: number[];
    prediction?: number[]; // Optional prediction line
    progress?: number;     // e.g. 0.48 (time elapsed / total time)
    color?: string;
    predColor?: string;
    width?: number;
    height?: number;
}

export default function Sparkline({
    data,
    prediction,
    progress = 0.5,
    color = '#33CCBB',
    predColor = '#f59e0b',
    width = 100,
    height = 30
}: SparklineProps) {
    if (!data || data.length === 0) return null;

    // Combine data limits to scale both lines to same y-axis
    const allValues = [...data, ...(prediction || [])];
    const max = Math.max(...allValues);
    const min = Math.min(...allValues);
    const range = max - min || 1;

    const hasPrediction = Array.isArray(prediction) && prediction.length > 0;
    const historyCount = data.length;

    // Proportionally divide width between history and prediction based on true time progress
    const cleanProgress = Math.max(0.05, Math.min(0.95, progress));
    const historyWidth = hasPrediction ? cleanProgress * width : width;
    const predictWidth = hasPrediction ? (1 - cleanProgress) * width : 0;

    // Path for history (starts from x=0 to x=historyWidth)
    const historyPath = data.map((val, i) => {
        const x = historyCount > 1 ? (i / (historyCount - 1)) * historyWidth : 0;
        const y = height - ((val - min) / range) * height;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    // Path for prediction (starts from last history point at x=historyWidth to x=width)
    let predictionPath = '';
    if (hasPrediction && prediction.length > 0) {
        const lastHistoryVal = data[data.length - 1];
        const fullPredPoints = [lastHistoryVal, ...prediction];
        predictionPath = fullPredPoints.map((val, i) => {
            const x = historyWidth + (i / Math.max(1, fullPredPoints.length - 1)) * predictWidth;
            const y = height - ((val - min) / range) * height;
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
    }

    return (
        <svg width={width} height={height} className="overflow-visible">
            {/* Prediction Line */}
            {predictionPath && (
                <path
                    d={predictionPath}
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
                d={historyPath}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
