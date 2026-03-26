"use client";
import React from "react";
import Modal from "@/components/common/Modal";

interface SelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export default function SelectorModal({ isOpen, onClose, title, children }: SelectorModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="xl"
        >
            <div className="min-h-[68vh]">
                {children}
            </div>
        </Modal>
    );
}
