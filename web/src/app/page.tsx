"use client";
import { useState } from "react";
import Link from "next/link";
import MainLayout from "@/components/MainLayout";

export default function Home() {
  return (
    <MainLayout activeNav="首页" showLoader={true}>
      <div className="container mx-auto px-6 pt-20 pb-20 flex flex-col items-center gap-12 text-center">

        {/* Main Title Section */}
        <div className="space-y-6 animate-fade-in-up">
          {/* Beta Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-amber-200 bg-amber-50 rounded-full mb-4 text-amber-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-xs font-bold tracking-wider uppercase">
              Beta 测试版
            </span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-black text-primary-text leading-tight">
            <span className="text-miku mx-2">Snowybot</span> Viewer
          </h1>

          {/* Performance Tip */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-green-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs">
              若页面出现卡顿，尝试在设置中使用<strong>省电模式</strong>
            </span>
          </div>

        </div>

        {/* Shortcuts Section (捷径) */}
        <div className="w-full max-w-5xl">
          <h2 className="text-xl font-bold text-primary-text mb-6 text-left opacity-80">捷径</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Card 1: Cards */}
            <Link href="/cards" className="group">
              <div className="p-4 rounded-2xl glass-card hover:bg-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 flex flex-col items-center gap-2 text-center h-full justify-center">
                <h3 className="text-lg font-bold text-primary-text group-hover:text-miku transition-colors">卡牌</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Card Database</p>
              </div>
            </Link>

            {/* Card 2: Music */}
            <Link href="/music" className="group">
              <div className="p-4 rounded-2xl glass-card hover:bg-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 flex flex-col items-center gap-2 text-center h-full justify-center">
                <h3 className="text-lg font-bold text-primary-text group-hover:text-miku transition-colors">音乐</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Music Library</p>
              </div>
            </Link>

            {/* Card 3: Events */}
            <Link href="/events" className="group">
              <div className="p-4 rounded-2xl glass-card hover:bg-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 flex flex-col items-center gap-2 text-center h-full justify-center">
                <h3 className="text-lg font-bold text-primary-text group-hover:text-miku transition-colors">活动</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Event Library</p>
              </div>
            </Link>

            {/* Card 4: Gacha */}
            <Link href="/gacha" className="group">
              <div className="p-4 rounded-2xl glass-card hover:bg-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 flex flex-col items-center gap-2 text-center h-full justify-center">
                <h3 className="text-lg font-bold text-primary-text group-hover:text-miku transition-colors">扭蛋</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Gacha</p>
              </div>
            </Link>

            {/* Card 5: Sticker */}
            <Link href="/sticker" className="group">
              <div className="p-4 rounded-2xl glass-card hover:bg-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 flex flex-col items-center gap-2 text-center h-full justify-center">
                <h3 className="text-lg font-bold text-primary-text group-hover:text-miku transition-colors">贴纸</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Sticker</p>
              </div>
            </Link>

            {/* Card 6: Comic */}
            <Link href="/comic" className="group">
              <div className="p-4 rounded-2xl glass-card hover:bg-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 flex flex-col items-center gap-2 text-center h-full justify-center">
                <h3 className="text-lg font-bold text-primary-text group-hover:text-miku transition-colors">漫画</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Comic</p>
              </div>
            </Link>

            {/* Card 7: Virtual Live */}
            <Link href="/live" className="group">
              <div className="p-4 rounded-2xl glass-card hover:bg-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 flex flex-col items-center gap-2 text-center h-full justify-center">
                <h3 className="text-lg font-bold text-primary-text group-hover:text-miku transition-colors">演唱会</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Virtual Live</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Friendly Links Section (友链) */}
        <div className="w-full max-w-4xl mt-8">
          <h2 className="text-xl font-bold text-primary-text mb-6 text-left opacity-80">友链</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Link 1: SnowyBot */}
            <a href="https://snowybot.exmeaning.com" target="_blank" className="relative group overflow-hidden rounded-xl h-20 shadow-sm hover:shadow-lg transition-shadow bg-white border border-slate-100">
              <div className="relative z-10 h-full flex items-center justify-between px-6">
                <div className="text-left">
                  <h3 className="text-md font-bold text-primary-text">SnowyBot 主站</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Main Site</p>
                </div>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </a>

            {/* Link 2: Story */}
            <a href="https://sekaistory.exmeaning.com/" target="_blank" className="relative group overflow-hidden rounded-xl h-20 shadow-sm hover:shadow-lg transition-shadow bg-white border border-slate-100">
              <div className="relative z-10 h-full flex items-center justify-between px-6">
                <div className="text-left">
                  <h3 className="text-md font-bold text-primary-text">剧情站</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Story Reader</p>
                </div>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
            </a>

            {/* Link 3: Predictor */}
            <a href="https://sekaibangdan.exmeaning.com" target="_blank" className="relative group overflow-hidden rounded-xl h-20 shadow-sm hover:shadow-lg transition-shadow bg-white border border-slate-100">
              <div className="relative z-10 h-full flex items-center justify-between px-6">
                <div className="text-left">
                  <h3 className="text-md font-bold text-primary-text">预测站</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Predictor</p>
                </div>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-miku transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
            </a>
          </div>
        </div>

        {/* Credits Section (鸣谢) */}
        <div className="w-full max-w-4xl mt-8 pt-8 border-t border-slate-200/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">鸣谢</h2>
            <div className="flex flex-wrap justify-center gap-4 text-xs">
              <a href="https://github.com/MejiroRina" target="_blank" className="font-bold text-slate-500 hover:text-miku transition-colors">Haruki（希凪）</a>
              <span className="text-slate-300">•</span>
              <a href="https://sekai.best" target="_blank" className="font-bold text-slate-500 hover:text-miku transition-colors">Sekai.best</a>
              <span className="text-slate-300">•</span>
              <a href="https://github.com/watagashi-uni" target="_blank" className="font-bold text-slate-500 hover:text-miku transition-colors">Uni</a>
            </div>
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
