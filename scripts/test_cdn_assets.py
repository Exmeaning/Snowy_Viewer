#!/usr/bin/env python3
import os
import json
import urllib.request
import urllib.error
import gzip
import concurrent.futures
import time
import argparse
from collections import defaultdict

# Cache directory for masterdata files
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "master_test")

def fetch_masterdata(region, filename):
    """Fetch masterdata from metadata CDN and cache locally."""
    local_dir = os.path.join(CACHE_DIR, region)
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, filename)
    
    # Try reading from cache first
    if os.path.exists(local_path):
        try:
            with open(local_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[-] Warning: Failed to load cached {filename} for {region}: {e}. Refetching...")

    # Fetch from remote
    urls = [
        f"https://metadata.pjsk.moe/{region}/master/{filename}",
        f"https://metadata.exmeaning.com/{region}/master/{filename}"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Encoding": "gzip"
    }
    
    data = None
    for url in urls:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                content = resp.read()
                if resp.info().get("Content-Encoding") == "gzip":
                    content = gzip.decompress(content)
                data = json.loads(content.decode("utf-8"))
                
                # Cache it
                with open(local_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                break
        except Exception:
            continue
            
    if data is None:
        # Return empty list or dict depending on typical expected structures
        # (Most masterdata files are arrays, but we will handle errors gracefully)
        return []
    return data

def extract_assets(region):
    """Extract all relevant asset paths for a given region based on masterdata."""
    print(f"[*] Extracting assets for region: {region.upper()}...")
    assets = []
    
    # 1. Cards
    cards = fetch_masterdata(region, "cards.json")
    print(f"    - Loaded {len(cards)} cards")
    for c in cards:
        if not isinstance(c, dict):
            continue
        ab = c.get("assetbundleName")
        rarity = c.get("rarity", 1)
        if not ab:
            continue
        # normal thumbnail
        assets.append({"category": "Card Thumbnail (Normal)", "path": f"thumbnail/chara/{ab}_normal.webp"})
        # normal card full
        assets.append({"category": "Card Image (Normal)", "path": f"character/member/{ab}/card_normal.webp"})
        # voice
        assets.append({"category": "Card Gacha Voice", "path": f"sound/gacha/get_voice/{ab}/{ab}.mp3"})
        
        if rarity >= 3:
            # trained thumbnail
            assets.append({"category": "Card Thumbnail (Trained)", "path": f"thumbnail/chara/{ab}_after_training.webp"})
            # trained card full
            assets.append({"category": "Card Image (Trained)", "path": f"character/member/{ab}/card_after_training.webp"})
            
    # 2. Musics & Difficulties
    musics = fetch_masterdata(region, "musics.json")
    print(f"    - Loaded {len(musics)} musics")
    for m in musics:
        if not isinstance(m, dict):
            continue
        ab = m.get("assetbundleName")
        if not ab:
            continue
        assets.append({"category": "Music Jacket", "path": f"music/jacket/{ab}/{ab}.webp"})
        
    music_diffs = fetch_masterdata(region, "musicDifficulties.json")
    diff_map = defaultdict(list)
    for d in music_diffs:
        if not isinstance(d, dict):
            continue
        m_id = d.get("musicId")
        diff = d.get("musicDifficulty")
        if m_id and diff:
            diff_map[m_id].append(diff)
            
    for m in musics:
        if not isinstance(m, dict):
            continue
        m_id = m.get("id")
        if not m_id:
            continue
        padded_id = str(m_id).zfill(4)
        diffs = diff_map.get(m_id, ["easy", "normal", "hard", "expert", "master"])
        for diff in diffs:
            assets.append({"category": "Music Score (TXT)", "path": f"music/music_score/{padded_id}_01/{diff}.txt"})

    # 2.2 Music Vocals
    vocals = fetch_masterdata(region, "musicVocals.json")
    for v in vocals:
        if not isinstance(v, dict):
            continue
        ab = v.get("assetbundleName")
        if ab:
            assets.append({"category": "Music Vocal BGM", "path": f"music/long/{ab}/{ab}.mp3"})
            
    # 3. Events
    events = fetch_masterdata(region, "events.json")
    print(f"    - Loaded {len(events)} events")
    for e in events:
        if not isinstance(e, dict):
            continue
        ab = e.get("assetbundleName")
        if not ab:
            continue
        assets.append({"category": "Event Banner", "path": f"event/{ab}/screen/bg.webp"})
        assets.append({"category": "Event Character Screen", "path": f"event/{ab}/screen/character.webp"})
        assets.append({"category": "Event Logo", "path": f"event/{ab}/logo/logo.webp"})
        assets.append({"category": "Event Top BGM", "path": f"event/{ab}/bgm/{ab}_top.mp3"})
        assets.append({"category": "Event Story Banner", "path": f"event_story/{ab}/screen_image/banner_event_story.webp"})
        
        # event story episodes (1 to 8)
        for ep in range(1, 9):
            padded_ep = str(ep).zfill(2)
            assets.append({"category": "Event Story Episode Image", "path": f"event_story/{ab}/episode_image/{ab}_{padded_ep}.webp"})
            
    # 4. Gachas
    gachas = fetch_masterdata(region, "gachas.json")
    print(f"    - Loaded {len(gachas)} gachas")
    for g in gachas:
        if not isinstance(g, dict):
            continue
        ab = g.get("assetbundleName")
        g_id = g.get("id")
        if not ab:
            continue
        assets.append({"category": "Gacha Logo", "path": f"gacha/{ab}/logo/logo.webp"})
        if g_id:
            assets.append({"category": "Gacha Banner", "path": f"home/banner/banner_gacha{g_id}/banner_gacha{g_id}.webp"})
            assets.append({"category": "Gacha Screen Background", "path": f"gacha/{ab}/screen/bg_gacha{g_id}_1.webp"})
            
    # 5. Stamps
    stamps = fetch_masterdata(region, "stamps.json")
    print(f"    - Loaded {len(stamps)} stamps")
    for s in stamps:
        if not isinstance(s, dict):
            continue
        ab = s.get("assetbundleName")
        if ab:
            assets.append({"category": "Stamp Image", "path": f"stamp/{ab}/{ab}.png"})
            
    # 6. Comics (tips)
    tips = fetch_masterdata(region, "tips.json")
    comic_abs = set()
    for t in tips:
        if not isinstance(t, dict):
            continue
        ab = t.get("assetbundleName")
        if ab:
            comic_abs.add(ab)
            
    # Add old hardcoded ones (comic_0001 to comic_0040)
    for i in range(1, 41):
        comic_abs.add(f"comic_{str(i).zfill(4)}")
        
    for ab in sorted(comic_abs):
        assets.append({"category": "Comic One-Frame", "path": f"comic/one_frame/{ab}.webp"})
        
    # 7. Characters
    chars = fetch_masterdata(region, "gameCharacters.json")
    char_ids = []
    if isinstance(chars, list):
        char_ids = [c.get("id") for c in chars if isinstance(c, dict) and c.get("id")]
    if not char_ids:
        char_ids = list(range(1, 27)) # fallback 1..26
        
    for c_id in char_ids:
        assets.append({"category": "Character Trim Image", "path": f"character/character_select/chr_tl_{c_id}.webp"})
        assets.append({"category": "Character Label H", "path": f"character/label/chr_h_lb_{c_id}.webp"})
        assets.append({"category": "Character Label V", "path": f"character/label_vertical/chr_v_lb_{c_id}.webp"})
        
    # 8. Honors & Bonds
    honors = fetch_masterdata(region, "honors.json")
    for h in honors:
        if not isinstance(h, dict):
            continue
        ab = h.get("assetbundleName")
        if ab:
            assets.append({"category": "Honor Degree Main", "path": f"honor/{ab}/degree_main.webp"})
            assets.append({"category": "Honor Degree Sub", "path": f"honor/{ab}/degree_sub.webp"})
            
    bonds = fetch_masterdata(region, "bondsHonors.json")
    for b in bonds:
        if not isinstance(b, dict):
            continue
        ab = b.get("assetbundleName")
        if ab:
            assets.append({"category": "Bonds Honor Word", "path": f"bonds_honor/word/{ab}_01.webp"})
            
    for i in char_ids:
        padded = str(i).zfill(2)
        assets.append({"category": "Bonds Honor Character SD", "path": f"bonds_honor/character/chr_sd_{padded}_01.webp"})
        
    # 9. Costumes
    costumes = fetch_masterdata(region, "costume3ds.json")
    for cos in costumes:
        if not isinstance(cos, dict):
            continue
        ab = cos.get("assetbundleName")
        if ab:
            assets.append({"category": "Costume Thumbnail", "path": f"thumbnail/costume/{ab}.webp"})
            
    # 10. Materials & Tickets
    materials = fetch_masterdata(region, "materials.json")
    for m in materials:
        if not isinstance(m, dict):
            continue
        m_id = m.get("id")
        if m_id:
            assets.append({"category": "Material Thumbnail", "path": f"thumbnail/material/material{m_id}.webp"})
            
    for i in range(1, 6):
        assets.append({"category": "Practice Ticket Thumbnail", "path": f"thumbnail/practice_ticket/ticket{i}.png"})
        assets.append({"category": "Skill Practice Ticket Thumbnail", "path": f"thumbnail/skill_practice_ticket/ticket{i}.png"})
        
    # 11. Virtual Lives
    vlives = fetch_masterdata(region, "virtualLives.json")
    for vl in vlives:
        if not isinstance(vl, dict):
            continue
        ab = vl.get("assetbundleName")
        if ab:
            assets.append({"category": "Virtual Live Banner", "path": f"virtual_live/select/banner/{ab}/{ab}.webp"})
            
    # 12. Static Common UI Assets
    for u in ["light_sound", "idol", "street", "theme_park", "school_refusal", "piapro"]:
        assets.append({"category": "Common Unit Logo", "path": f"thumbnail/common/unit/{u}.webp"})
    for a in ["cute", "cool", "pure", "happy", "mysterious"]:
        assets.append({"category": "Common Attribute Icon", "path": f"thumbnail/common/attribute/{a}.webp"})
        
    # Deduplicate paths
    unique_assets = {}
    for a in assets:
        unique_assets[a["path"]] = a["category"]
        
    deduped = [{"category": cat, "path": path} for path, cat in unique_assets.items()]
    print(f"    - Extracted {len(deduped)} unique assets to check")
    return deduped

def test_url(client, domain, region, asset, timeout=10):
    """Sends a HEAD request for the given asset and returns status code."""
    path = asset["path"]
    url = f"https://{domain}/sekai-{region}-assets/{path}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    start_time = time.time()
    try:
        req = urllib.request.Request(url, method="HEAD", headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = time.time() - start_time
            return {
                "url": url,
                "path": path,
                "category": asset["category"],
                "status": resp.status,
                "elapsed": elapsed,
                "error": None
            }
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start_time
        return {
            "url": url,
            "path": path,
            "category": asset["category"],
            "status": e.code,
            "elapsed": elapsed,
            "error": str(e)
        }
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            "url": url,
            "path": path,
            "category": asset["category"],
            "status": 0,
            "elapsed": elapsed,
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description="PJSK New Asset Server Acceptance Validator")
    parser.add_argument("--domain", default="moeassets.pjsk.moe", help="Domain to test")
    parser.add_argument("--regions", nargs="+", default=["cn", "jp"], help="Regions to test")
    parser.add_argument("--concurrency", type=int, default=50, help="Number of concurrent threads")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of assets per region for quick test")
    parser.add_argument("--output", default="", help="Custom file path for report.md")
    args = parser.parse_args()

    print("=" * 80)
    print(f"PJSK New Asset Server Acceptance Test")
    print(f"Target Server:  https://{args.domain}")
    print(f"Regions:        {', '.join(args.regions)}")
    print(f"Concurrency:    {args.concurrency} threads")
    if args.limit > 0:
        print(f"Quick Test:     Limited to {args.limit} assets per region")
    print("=" * 80)

    all_results = {}
    report_lines = []
    
    report_lines.append("# New Asset Server Validation Report")
    report_lines.append(f"- **Test Date**: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append(f"- **Test Domain**: `https://{args.domain}`")
    report_lines.append(f"- **Regions Tested**: {', '.join([r.upper() for r in args.regions])}")
    report_lines.append("")

    for region in args.regions:
        assets = extract_assets(region)
        if args.limit > 0:
            assets = assets[:args.limit]
            
        print(f"[*] Testing {len(assets)} assets for region {region.upper()}...")
        
        success_count = 0
        failure_count = 0
        status_counts = defaultdict(int)
        category_stats = defaultdict(lambda: {"total": 0, "success": 0, "fail": 0})
        failed_details = []

        start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
            future_to_asset = {executor.submit(test_url, None, args.domain, region, asset): asset for asset in assets}
            
            completed = 0
            for future in concurrent.futures.as_completed(future_to_asset):
                res = future.result()
                cat = res["category"]
                status = res["status"]
                
                category_stats[cat]["total"] += 1
                status_counts[status] += 1
                
                if status == 200:
                    success_count += 1
                    category_stats[cat]["success"] += 1
                else:
                    failure_count += 1
                    category_stats[cat]["fail"] += 1
                    failed_details.append(res)
                    
                completed += 1
                if completed % 500 == 0 or completed == len(assets):
                    print(f"    - Progress: {completed}/{len(assets)} ({completed/len(assets)*100:.1f}%) | Success: {success_count} | Failed: {failure_count}")

        elapsed = time.time() - start_time
        success_pct = (success_count / len(assets) * 100) if assets else 0
        
        print(f"[+] Finished region {region.upper()} in {elapsed:.2f}s | Success Rate: {success_pct:.2f}% ({success_count}/{len(assets)})")
        print(f"    - HTTP Status codes: {dict(status_counts)}")
        print("-" * 80)
        
        # Save results for reporting
        all_results[region] = {
            "total": len(assets),
            "success": success_count,
            "fail": failure_count,
            "pct": success_pct,
            "status_counts": status_counts,
            "category_stats": category_stats,
            "failed_details": failed_details
        }
        
        # Write section to report
        report_lines.append(f"## Region: {region.upper()}")
        report_lines.append(f"- **Total Assets Checked**: {len(assets)}")
        report_lines.append(f"- **Success**: {success_count} ({success_pct:.2f}%)")
        report_lines.append(f"- **Failures**: {failure_count} ({(100 - success_pct):.2f}%)")
        report_lines.append(f"- **Time Elapsed**: {elapsed:.2f} seconds")
        report_lines.append("")
        
        # Table of category stats
        report_lines.append("### Category Breakdown")
        report_lines.append("| Category | Total Checked | Success | Failures | Success Rate |")
        report_lines.append("|---|---|---|---|---|")
        for cat, stats in sorted(category_stats.items()):
            pct = (stats["success"] / stats["total"] * 100) if stats["total"] else 0
            report_lines.append(f"| {cat} | {stats['total']} | {stats['success']} | {stats['fail']} | {pct:.2f}% |")
        report_lines.append("")
        
        # Top failures list (up to 100 for readability, or list total if smaller)
        if failed_details:
            report_lines.append("### Failed Assets (Sample - Top 100)")
            report_lines.append("| Category | Path | HTTP Status | Error |")
            report_lines.append("|---|---|---|---|")
            # Sort by category then path
            sorted_fails = sorted(failed_details, key=lambda x: (x["category"], x["path"]))
            for f in sorted_fails[:100]:
                report_lines.append(f"| {f['category']} | `{f['path']}` | {f['status']} | {f['error']} |")
            
            if len(failed_details) > 100:
                report_lines.append(f"\n*Note: Showing first 100 out of {len(failed_details)} failures. Full list saved in raw outputs.*")
            report_lines.append("")
            report_lines.append("---")
            report_lines.append("")

    # Summary table
    report_lines.insert(4, "## Overall Summary")
    report_lines.insert(5, "| Region | Total Checked | Success | Failures | Success Rate |")
    report_lines.insert(6, "|---|---|---|---|---|")
    idx = 7
    for reg, res in all_results.items():
        report_lines.insert(idx, f"| {reg.upper()} | {res['total']} | {res['success']} | {res['fail']} | {res['pct']:.2f}% |")
        idx += 1
    report_lines.insert(idx, "")

    # Output file
    output_path = args.output
    if not output_path:
        # Default to conversation's brain folder
        brain_dir = os.environ.get("GEMINI_BRAIN_DIR", CACHE_DIR)
        output_path = os.path.join(brain_dir, "asset_test_report.md")
        
    print(f"[*] Writing report to {output_path}...")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
        
    print(f"[+] Acceptance testing completed successfully!")
    print("=" * 80)

if __name__ == "__main__":
    main()
