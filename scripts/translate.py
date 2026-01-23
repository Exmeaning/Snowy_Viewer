#!/usr/bin/env python3
"""
Translation Script for Snowy Viewer
Extracts Japanese text from JP masterdata and translates to Chinese.

Translation Sources (in priority order):
1. CN Server masterdata (official translations, matched by ID)
2. LLM translation (Gemini or SiliconFlow Qwen as fallback)

Translation data includes source tracking for incremental updates:
- "cn": Official translation from CN server
- "llm": LLM-generated translation

Usage:
    python scripts/translate.py --help
    python scripts/translate.py --dry-run                  # Show what would be translated
    python scripts/translate.py --category cards           # Translate only cards
    python scripts/translate.py --cn-only                  # Only use CN translations, no LLM
    python scripts/translate.py --llm gemini               # Use Gemini instead of SiliconFlow
    python scripts/translate.py                            # Translate all categories
"""

import json
import os
import sys
import argparse
import time
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import urllib.request
import urllib.error

# Configuration
BATCH_SIZE = 20  # Number of texts to translate in one API call
RATE_LIMIT_DELAY = 1.0  # Seconds between API calls

# LLM API Configurations
LLM_CONFIGS = {
    "qwen": {
        "url": "https://api.siliconflow.cn/v1/chat/completions",
        "model": "Qwen/Qwen3-8B",
        "env_key": "SILICONFLOW_API_KEY",
    },
    "gemini": {
        "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
        "model": "gemini-3-flash-preview",
        "env_key": "GEMINI_API_KEY",
    }
}

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "web" / "public" / "data" / "translations"

# Server URLs
JP_MASTERDATA_URL = "https://sekaimaster.exmeaning.com/master"
CN_MASTERDATA_URL = "https://sekaimaster-cn.exmeaning.com/master"

# Game context prompt for LLM
GAME_CONTEXT_PROMPT = """你是一个专业的游戏翻译器，专门翻译《世界计划 彩色舞台 feat. 初音未来》(Project SEKAI) 游戏内容。

游戏背景设定：
游戏中存在一个现实世界和虚拟世界「世界」，游戏的主人公团体（5个团体，每个团有4个角色）各有一个「世界」，他们能够通过电子设备上神秘出现的「Untitled」歌曲往返现实世界和「世界」。在「世界」中，原本在现实世界的虚拟歌手（比如初音未来）变为了真实的存在，能够与主人公团体互动。「世界」反映的是主人的强烈的心愿，而虚拟歌手们会帮助主人公团体一步步达成他们的心愿。

角色译名表（日文 -> 中文）：
Virtual Singer(虚拟歌手):
- 初音ミク: 初音未来
- 鏡音リン: 镜音铃
- 鏡音レン: 镜音连
- 巡音ルカ: 巡音流歌
- MEIKO: MEIKO
- KAITO: KAITO

Leo/need (教室的世界):
- 星乃一歌: 星乃一歌
- 天馬咲希: 天马咲希
- 望月穂波: 望月穗波
- 日野森志歩: 日野森志步

MORE MORE JUMP! (舞台的世界):
- 花里みのり: 花里实乃里
- 桐谷遥: 桐谷遥
- 桃井愛莉: 桃井爱莉
- 日野森雫: 日野森雫

Vivid BAD SQUAD (街头的世界):
- 小豆沢こはね: 小豆泽心羽
- 白石杏: 白石杏
- 東雲彰人: 东云彰人
- 青柳冬弥: 青柳冬弥

Wonderlands×Showtime (奇幻的世界):
- 天馬司: 天马司
- 鳳えむ: 凤笑梦
- 草薙寧々: 草薙宁宁
- 神代類: 神代类

25時、ナイトコードで。(无人的世界):
- 宵崎奏: 宵崎奏
- 朝比奈まふゆ: 朝比奈真冬
- 東雲絵名: 东云绘名
- 暁山瑞希: 暁山瑞希

请将以下日文文本翻译成简体中文。保持翻译简洁、自然，符合游戏风格。
只返回翻译结果，每行一个，与输入顺序对应。不要添加序号或额外说明。

待翻译文本：
"""


def get_api_key(llm_type: str) -> str:
    """Get API key from environment variable"""
    config = LLM_CONFIGS[llm_type]
    api_key = os.environ.get(config["env_key"])
    if not api_key:
        print(f"Error: {config['env_key']} environment variable not set")
        print(f"Please set it with: set {config['env_key']}=your_api_key")
        sys.exit(1)
    return api_key


def fetch_masterdata(filename: str, server: str = "jp") -> Optional[Any]:
    """Fetch masterdata JSON from specified server"""
    base_url = JP_MASTERDATA_URL if server == "jp" else CN_MASTERDATA_URL
    url = f"{base_url}/{filename}"
    try:
        print(f"  Fetching [{server.upper()}] {filename}...")
        req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip"})
        with urllib.request.urlopen(req, timeout=30) as response:
            data = response.read()
            if response.info().get("Content-Encoding") == "gzip":
                import gzip
                data = gzip.decompress(data)
            return json.loads(data.decode("utf-8"))
    except urllib.error.URLError as e:
        print(f"  Warning: Failed to fetch {filename} from {server}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"  Warning: Failed to parse {filename}: {e}")
        return None


def call_qwen_api(api_key: str, texts: List[str]) -> List[str]:
    """Call SiliconFlow Qwen API"""
    config = LLM_CONFIGS["qwen"]
    prompt = GAME_CONTEXT_PROMPT + "\n".join(texts)
    
    payload = {
        "model": config["model"],
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 4096,
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(config["url"], data=data, headers=headers, method="POST")
        
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]
            
            translations = [line.strip() for line in content.strip().split("\n") if line.strip()]
            
            # Handle /no_think markers from Qwen
            cleaned = []
            for t in translations:
                if t.startswith("/no_think") or t.startswith("<think>") or t.endswith("</think>"):
                    continue
                cleaned.append(t)
            
            return cleaned
            
    except Exception as e:
        print(f"  Qwen API Error: {e}")
        return []


def call_gemini_api(api_key: str, texts: List[str]) -> List[str]:
    """Call Google Gemini API"""
    config = LLM_CONFIGS["gemini"]
    prompt = GAME_CONTEXT_PROMPT + "\n".join(texts)
    
    url = f"{config['url']}?key={api_key}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 4096,
        }
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result["candidates"][0]["content"]["parts"][0]["text"]
            
            translations = [line.strip() for line in content.strip().split("\n") if line.strip()]
            return translations
            
    except Exception as e:
        print(f"  Gemini API Error: {e}")
        return []


def call_llm(api_key: str, texts: List[str], llm_type: str) -> List[str]:
    """Call LLM API to translate texts"""
    if not texts:
        return []
    
    if llm_type == "gemini":
        return call_gemini_api(api_key, texts)
    else:
        return call_qwen_api(api_key, texts)


def translate_batch(api_key: str, texts: List[str], llm_type: str, dry_run: bool = False) -> Dict[str, str]:
    """Translate a batch of texts using LLM and return mapping"""
    if dry_run:
        return {t: f"[LLM翻译] {t}" for t in texts}
    
    translations = call_llm(api_key, texts, llm_type)
    
    result = {}
    for i, original in enumerate(texts):
        if i < len(translations):
            translated = translations[i]
            # Even if translation is same as original, we save it to prevent re-translation
            if translated:
                result[original] = translated
        else:
            print(f"  Warning: Missing translation for: {original[:50]}...")
    
    return result


# ============================================================================
# Translation data structure with source tracking
# Format: { "field": { "jp_text": { "text": "cn_text", "source": "cn" | "llm" } } }
# For backward compatibility, also supports flat format: { "field": { "jp_text": "cn_text" } }
# ============================================================================

def normalize_translation_data(data: Dict[str, Any]) -> Dict[str, Dict[str, Dict[str, str]]]:
    """Convert flat format to structured format with source tracking"""
    result = {}
    for field, translations in data.items():
        if not isinstance(translations, dict):
            continue
        result[field] = {}
        for jp_text, value in translations.items():
            if isinstance(value, dict) and "text" in value:
                # Already in new format
                result[field][jp_text] = value
            else:
                # Old flat format, assume it's from LLM (or unknown)
                result[field][jp_text] = {"text": str(value), "source": "unknown"}
    return result


def flatten_translation_data(data: Dict[str, Dict[str, Dict[str, str]]]) -> Dict[str, Dict[str, str]]:
    """Convert structured format back to flat format for frontend consumption"""
    result = {}
    for field, translations in data.items():
        result[field] = {}
        for jp_text, value in translations.items():
            if isinstance(value, dict) and "text" in value:
                result[field][jp_text] = value["text"]
            else:
                result[field][jp_text] = str(value)
    return result


# ============================================================================
# Extraction functions that get both JP and CN data
# ============================================================================

def extract_cards_with_cn() -> Tuple[Dict[str, Dict[str, str]], Dict[str, List[str]]]:
    """Extract card translations from CN server, and JP texts without CN translation"""
    jp_data = fetch_masterdata("cards.json", "jp")
    cn_data = fetch_masterdata("cards.json", "cn")
    
    cn_translations = {"prefix": {}, "skillName": {}, "gachaPhrase": {}}
    jp_only = {"prefix": [], "skillName": [], "gachaPhrase": []}
    
    if not jp_data:
        return cn_translations, jp_only
    
    cn_by_id = {c["id"]: c for c in (cn_data or [])}
    
    for card in jp_data:
        card_id = card["id"]
        cn_card = cn_by_id.get(card_id)
        
        jp_prefix = card.get("prefix", "")
        if jp_prefix:
            if cn_card and cn_card.get("prefix") and cn_card["prefix"] != jp_prefix:
                cn_translations["prefix"][jp_prefix] = cn_card["prefix"]
            else:
                jp_only["prefix"].append(jp_prefix)
        
        jp_skill = card.get("cardSkillName", "")
        if jp_skill:
            if cn_card and cn_card.get("cardSkillName") and cn_card["cardSkillName"] != jp_skill:
                cn_translations["skillName"][jp_skill] = cn_card["cardSkillName"]
            else:
                jp_only["skillName"].append(jp_skill)

        jp_phrase = card.get("gachaPhrase", "")
        if jp_phrase and jp_phrase != "-":
            if cn_card and cn_card.get("gachaPhrase") and cn_card["gachaPhrase"] != jp_phrase:
                cn_translations["gachaPhrase"][jp_phrase] = cn_card["gachaPhrase"]
            else:
                jp_only["gachaPhrase"].append(jp_phrase)
    
    return cn_translations, jp_only


def extract_events_with_cn() -> Tuple[Dict[str, Dict[str, str]], Dict[str, List[str]]]:
    """Extract event translations from CN server"""
    jp_data = fetch_masterdata("events.json", "jp")
    cn_data = fetch_masterdata("events.json", "cn")
    
    cn_translations = {"name": {}}
    jp_only = {"name": []}
    
    if not jp_data:
        return cn_translations, jp_only
    
    cn_by_id = {e["id"]: e for e in (cn_data or [])}
    
    for event in jp_data:
        event_id = event["id"]
        cn_event = cn_by_id.get(event_id)
        
        jp_name = event.get("name", "")
        if jp_name:
            if cn_event and cn_event.get("name") and cn_event["name"] != jp_name:
                cn_translations["name"][jp_name] = cn_event["name"]
            else:
                jp_only["name"].append(jp_name)
    
    return cn_translations, jp_only


def extract_gacha_with_cn() -> Tuple[Dict[str, Dict[str, str]], Dict[str, List[str]]]:
    """Extract gacha translations from CN server"""
    jp_data = fetch_masterdata("gachas.json", "jp")
    cn_data = fetch_masterdata("gachas.json", "cn")
    
    cn_translations = {"name": {}}
    jp_only = {"name": []}
    
    if not jp_data:
        return cn_translations, jp_only
    
    cn_by_id = {g["id"]: g for g in (cn_data or [])}
    
    for gacha in jp_data:
        gacha_id = gacha["id"]
        cn_gacha = cn_by_id.get(gacha_id)
        
        jp_name = gacha.get("name", "")
        if jp_name:
            if cn_gacha and cn_gacha.get("name") and cn_gacha["name"] != jp_name:
                cn_translations["name"][jp_name] = cn_gacha["name"]
            else:
                jp_only["name"].append(jp_name)
    
    return cn_translations, jp_only


def extract_virtual_live_with_cn() -> Tuple[Dict[str, Dict[str, str]], Dict[str, List[str]]]:
    """Extract virtual live translations from CN server"""
    jp_data = fetch_masterdata("virtualLives.json", "jp")
    cn_data = fetch_masterdata("virtualLives.json", "cn")
    
    cn_translations = {"name": {}}
    jp_only = {"name": []}
    
    if not jp_data:
        return cn_translations, jp_only
    
    cn_by_id = {v["id"]: v for v in (cn_data or [])}
    
    for vl in jp_data:
        vl_id = vl["id"]
        cn_vl = cn_by_id.get(vl_id)
        
        jp_name = vl.get("name", "")
        if jp_name:
            if cn_vl and cn_vl.get("name") and cn_vl["name"] != jp_name:
                cn_translations["name"][jp_name] = cn_vl["name"]
            else:
                jp_only["name"].append(jp_name)
    
    return cn_translations, jp_only


def extract_sticker_with_cn() -> Tuple[Dict[str, Dict[str, str]], Dict[str, List[str]]]:
    """Extract sticker translations from CN server"""
    jp_data = fetch_masterdata("stamps.json", "jp")
    cn_data = fetch_masterdata("stamps.json", "cn")
    
    cn_translations = {"name": {}}
    jp_only = {"name": []}
    
    if not jp_data:
        return cn_translations, jp_only
    
    cn_by_id = {s["id"]: s for s in (cn_data or [])}
    
    for stamp in jp_data:
        stamp_id = stamp["id"]
        cn_stamp = cn_by_id.get(stamp_id)
        
        jp_name = stamp.get("name", "")
        if jp_name:
            if cn_stamp and cn_stamp.get("name") and cn_stamp["name"] != jp_name:
                cn_translations["name"][jp_name] = cn_stamp["name"]
            else:
                jp_only["name"].append(jp_name)
    
    return cn_translations, jp_only


def extract_comic_with_cn() -> Tuple[Dict[str, Dict[str, str]], Dict[str, List[str]]]:
    """Extract comic translations from CN server (using tips.json)"""
    # Note: Snowy Viewer uses tips.json with assetbundleName for comics
    jp_data = fetch_masterdata("tips.json", "jp")
    cn_data = fetch_masterdata("tips.json", "cn")
    
    cn_translations = {"title": {}}
    jp_only = {"title": []}
    
    if not jp_data:
        return cn_translations, jp_only
    
    # Filter for comics (tips that have assetbundleName)
    jp_comics = [c for c in jp_data if c.get("assetbundleName")]
    
    cn_by_id = {c["id"]: c for c in (cn_data or [])}
    
    for comic in jp_comics:
        comic_id = comic["id"]
        cn_comic = cn_by_id.get(comic_id)
        
        jp_title = comic.get("title", "")
        if jp_title:
            if cn_comic and cn_comic.get("title") and cn_comic["title"] != jp_title:
                cn_translations["title"][jp_title] = cn_comic["title"]
            else:
                jp_only["title"].append(jp_title)
    
    return cn_translations, jp_only


def extract_music_texts() -> Tuple[Dict[str, Dict[str, str]], Dict[str, List[str]]]:
    """Extract music texts - CN doesn't have music translations, LLM only"""
    musics = fetch_masterdata("musics.json", "jp")
    vocals = fetch_masterdata("musicVocals.json", "jp")
    
    cn_translations = {"title": {}, "artist": {}, "vocalCaption": {}}
    jp_only = {"title": [], "artist": [], "vocalCaption": []}
    
    if musics:
        for music in musics:
            if music.get("title"):
                jp_only["title"].append(music["title"])
            for field in ["lyricist", "composer", "arranger"]:
                if music.get(field) and music[field] != "-":
                    jp_only["artist"].append(music[field])
    
    if vocals:
        for vocal in vocals:
            if vocal.get("caption"):
                jp_only["vocalCaption"].append(vocal["caption"])
    
    for key in jp_only:
        jp_only[key] = list(set(jp_only[key]))
    
    return cn_translations, jp_only


def extract_mysekai_with_cn() -> Tuple[Dict[str, Dict[str, str]], Dict[str, List[str]]]:
    """Extract mysekai translations from CN server"""
    jp_fixtures = fetch_masterdata("mysekaiFixtures.json", "jp")
    cn_fixtures = fetch_masterdata("mysekaiFixtures.json", "cn")
    jp_genres = fetch_masterdata("mysekaiFixtureMainGenres.json", "jp")
    cn_genres = fetch_masterdata("mysekaiFixtureMainGenres.json", "cn")
    jp_tags = fetch_masterdata("mysekaiFixtureTags.json", "jp")
    cn_tags = fetch_masterdata("mysekaiFixtureTags.json", "cn")
    
    cn_translations = {"fixtureName": {}, "flavorText": {}, "genre": {}, "tag": {}}
    jp_only = {"fixtureName": [], "flavorText": [], "genre": [], "tag": []}
    
    if jp_fixtures:
        cn_fix_by_id = {f["id"]: f for f in (cn_fixtures or [])}
        for f in jp_fixtures:
            fid = f["id"]
            cn_f = cn_fix_by_id.get(fid)
            
            jp_name = f.get("name", "")
            if jp_name:
                if cn_f and cn_f.get("name") and cn_f["name"] != jp_name:
                    cn_translations["fixtureName"][jp_name] = cn_f["name"]
                else:
                    jp_only["fixtureName"].append(jp_name)
            
            jp_flavor = f.get("flavorText", "")
            if jp_flavor:
                if cn_f and cn_f.get("flavorText") and cn_f["flavorText"] != jp_flavor:
                    cn_translations["flavorText"][jp_flavor] = cn_f["flavorText"]
                else:
                    jp_only["flavorText"].append(jp_flavor)
    
    if jp_genres:
        cn_gen_by_id = {g["id"]: g for g in (cn_genres or [])}
        for g in jp_genres:
            gid = g["id"]
            cn_g = cn_gen_by_id.get(gid)
            jp_name = g.get("name", "")
            if jp_name:
                if cn_g and cn_g.get("name") and cn_g["name"] != jp_name:
                    cn_translations["genre"][jp_name] = cn_g["name"]
                else:
                    jp_only["genre"].append(jp_name)
    
    if jp_tags:
        cn_tag_by_id = {t["id"]: t for t in (cn_tags or [])}
        for t in jp_tags:
            tid = t["id"]
            cn_t = cn_tag_by_id.get(tid)
            jp_name = t.get("name", "")
            if jp_name:
                if cn_t and cn_t.get("name") and cn_t["name"] != jp_name:
                    cn_translations["tag"][jp_name] = cn_t["name"]
                else:
                    jp_only["tag"].append(jp_name)
    
    for key in jp_only:
        jp_only[key] = list(set(jp_only[key]))
    
    return cn_translations, jp_only


def extract_characters_with_cn() -> Tuple[Dict[str, Dict[str, str]], Dict[str, List[str]]]:
    """
    Extract character profile translations from CN server (characterProfiles.json).
    Fields: hobby, specialSkill, favoriteFood, hatedFood, weak, introduction
    """
    jp_profiles = fetch_masterdata("characterProfiles.json", "jp")
    cn_profiles = fetch_masterdata("characterProfiles.json", "cn")
    
    fields = ["hobby", "specialSkill", "favoriteFood", "hatedFood", "weak", "introduction"]
    cn_translations = {f: {} for f in fields}
    jp_only = {f: [] for f in fields}
    
    if not jp_profiles:
        return cn_translations, jp_only
        
    cn_by_id = {p["characterId"]: p for p in (cn_profiles or [])}
    
    for profile in jp_profiles:
        char_id = profile["characterId"]
        cn_profile = cn_by_id.get(char_id)
        
        for field in fields:
            jp_text = profile.get(field, "")
            # Skip empty or placeholder texts
            if not jp_text or jp_text == "-":
                continue
                
            if cn_profile and cn_profile.get(field) and cn_profile[field] != jp_text:
                cn_translations[field][jp_text] = cn_profile[field]
            else:
                jp_only[field].append(jp_text)
                
    for key in jp_only:
        jp_only[key] = list(set(jp_only[key]))
        
    return cn_translations, jp_only


def extract_units_with_cn() -> Tuple[Dict[str, Dict[str, str]], Dict[str, List[str]]]:
    """
    Extract unit profile translations from CN server (unitProfiles.json).
    Fields: unitName, profileSentence
    """
    jp_units = fetch_masterdata("unitProfiles.json", "jp")
    cn_units = fetch_masterdata("unitProfiles.json", "cn")
    
    fields = ["unitName", "profileSentence"]
    cn_translations = {f: {} for f in fields}
    jp_only = {f: [] for f in fields}
    
    if not jp_units:
        return cn_translations, jp_only
        
    cn_by_unit = {u["unit"]: u for u in (cn_units or [])}
    
    for unit in jp_units:
        unit_id = unit["unit"]
        cn_unit = cn_by_unit.get(unit_id)
        
        for field in fields:
            jp_text = unit.get(field, "")
            if not jp_text:
                continue
                
            if cn_unit and cn_unit.get(field) and cn_unit[field] != jp_text:
                cn_translations[field][jp_text] = cn_unit[field]
            else:
                jp_only[field].append(jp_text)
                
    for key in jp_only:
        jp_only[key] = list(set(jp_only[key]))
        
    return cn_translations, jp_only


# ============================================================================
# Main translation logic with source tracking
# ============================================================================

def load_existing_translations(category: str) -> Dict[str, Dict[str, Dict[str, str]]]:
    """Load existing translations from file (with source tracking)"""
    # Try loading full data first (preserves source info)
    filepath_full = OUTPUT_DIR / f"{category}.full.json"
    if filepath_full.exists():
        try:
            with open(filepath_full, "r", encoding="utf-8") as f:
                data = json.load(f)
                return normalize_translation_data(data)
        except (json.JSONDecodeError, IOError):
            pass
            
    # Fallback to flat file
    filepath = OUTPUT_DIR / f"{category}.json"
    if filepath.exists():
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                return normalize_translation_data(data)
        except (json.JSONDecodeError, IOError):
            pass
    return {}


def save_translations(category: str, data: Dict[str, Dict[str, Dict[str, str]]], include_source: bool = True):
    """Save translations to file"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save with source tracking (for developers)
    filepath_full = OUTPUT_DIR / f"{category}.full.json"
    with open(filepath_full, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  Saved full data (with source) to {filepath_full}")
    
    # Save flattened version (for frontend)
    filepath = OUTPUT_DIR / f"{category}.json"
    flat_data = flatten_translation_data(data)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(flat_data, f, ensure_ascii=False, indent=2)
    print(f"  Saved flat data (for frontend) to {filepath}")


def translate_category_enhanced(
    api_key: str, 
    category: str, 
    extract_func, 
    llm_type: str = "qwen",
    dry_run: bool = False,
    cn_only: bool = False
):
    """Translate a category using CN server first, then LLM fallback"""
    print(f"\n{'='*60}")
    print(f"Translating: {category}")
    print(f"{'='*60}")
    
    # Extract translations from CN and texts needing LLM
    print("Extracting texts from JP & CN servers...")
    cn_translations, jp_only_texts = extract_func()
    
    # Load existing translations (with source tracking)
    existing = load_existing_translations(category)
    
    # Stats
    stats = {"cn_new": 0, "cn_updated": 0, "llm_new": 0}
    
    # Process each field
    for field in set(list(cn_translations.keys()) + list(jp_only_texts.keys())):
        existing_field = existing.get(field, {})
        cn_field = cn_translations.get(field, {})
        jp_field = jp_only_texts.get(field, [])
        
        # Process CN translations
        for jp_text, cn_text in cn_field.items():
            if jp_text not in existing_field:
                existing_field[jp_text] = {"text": cn_text, "source": "cn"}
                stats["cn_new"] += 1
            elif existing_field[jp_text].get("source") != "cn" or existing_field[jp_text].get("text") != cn_text:
                # Update: CN overwrites LLM, or CN text changed
                existing_field[jp_text] = {"text": cn_text, "source": "cn"}
                stats["cn_updated"] += 1
        
        print(f"  {field}: CN new={stats['cn_new']}, CN updated={stats['cn_updated']}")
        
        # Filter JP texts that still need LLM translation
        need_llm = [t for t in jp_field if t and t not in existing_field]
        
        if not need_llm:
            pass  # All covered
        elif cn_only:
            print(f"  {field}: {len(need_llm)} texts need LLM (skipped, --cn-only mode)")
        else:
            print(f"  {field}: {len(need_llm)} texts need LLM translation")
            
            for i in range(0, len(need_llm), BATCH_SIZE):
                batch = need_llm[i:i+BATCH_SIZE]
                print(f"    LLM Batch {i//BATCH_SIZE + 1}/{(len(need_llm)-1)//BATCH_SIZE + 1} ({len(batch)} texts)")
                
                translations = translate_batch(api_key, batch, llm_type, dry_run)
                for jp_text, cn_text in translations.items():
                    existing_field[jp_text] = {"text": cn_text, "source": "llm"}
                    stats["llm_new"] += 1
                
                if not dry_run and i + BATCH_SIZE < len(need_llm):
                    time.sleep(RATE_LIMIT_DELAY)
        
        existing[field] = existing_field
    
    print(f"  Summary: CN new={stats['cn_new']}, CN updated={stats['cn_updated']}, LLM={stats['llm_new']}")
    
    # Save results
    if not dry_run:
        save_translations(category, existing)
    else:
        print(f"  [DRY RUN] Would save to {OUTPUT_DIR / f'{category}.json'}")


def main():
    parser = argparse.ArgumentParser(description="Translate Snowy Viewer masterdata to Chinese")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be translated without calling API")
    parser.add_argument("--cn-only", action="store_true", help="Only use CN server translations, skip LLM")
    parser.add_argument("--llm", choices=["qwen", "gemini"], default="qwen", help="LLM to use (default: qwen)")
    parser.add_argument("--category", choices=["cards", "events", "music", "virtualLive", "gacha", "mysekai", "sticker", "comic"],
                        help="Translate only a specific category")
    args = parser.parse_args()
    
    api_key = ""
    if not args.dry_run and not args.cn_only:
        api_key = get_api_key(args.llm)
    
    print(f"LLM: {args.llm.upper()}")
    
    categories = {
        "cards": extract_cards_with_cn,
        "events": extract_events_with_cn,
        "music": extract_music_texts,
        "virtualLive": extract_virtual_live_with_cn,
        "gacha": extract_gacha_with_cn,
        "mysekai": extract_mysekai_with_cn,
        "sticker": extract_sticker_with_cn,
        "comic": extract_comic_with_cn,
        "characters": extract_characters_with_cn,
        "units": extract_units_with_cn,
    }
    
    priority_order = ["cards", "events", "gacha", "virtualLive", "mysekai", "sticker", "comic", "characters", "units", "music"]
    
    if args.category:
        translate_category_enhanced(api_key, args.category, categories[args.category], args.llm, args.dry_run, args.cn_only)
    else:
        for cat in priority_order:
            if cat in categories:
                translate_category_enhanced(api_key, cat, categories[cat], args.llm, args.dry_run, args.cn_only)
    
    print("\n" + "="*60)
    print("Translation complete!")
    print("="*60)


if __name__ == "__main__":
    main()
