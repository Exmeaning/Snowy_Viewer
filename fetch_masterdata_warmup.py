#!/usr/bin/env python3
import argparse
import concurrent.futures
import gzip
import time
import urllib.request
import urllib.error

# The 60 masterdata JSON files used in the Snowy Viewer project
MASTERDATA_FILES = [
    "actionSets.json",
    "areaItemLevels.json",
    "areaItems.json",
    "areas.json",
    "bonds.json",
    "bondsHonorWords.json",
    "bondsHonors.json",
    "cardEpisodes.json",
    "cardSupplies.json",
    "cards.json",
    "challengeLiveHighScoreRewards.json",
    "character2ds.json",
    "characterProfiles.json",
    "characterRanks.json",
    "eventCards.json",
    "eventDeckBonuses.json",
    "eventMusics.json",
    "eventStories.json",
    "events.json",
    "gachas.json",
    "gameCharacterUnits.json",
    "gameCharacters.json",
    "honorGroups.json",
    "honors.json",
    "limitedTimeMusics.json",
    "materialExchangeSummaries.json",
    "materials.json",
    "mobCharacters.json",
    "moe_costume.json",
    "musicDifficulties.json",
    "musicSoundTrackCategories.json",
    "musicSoundTracks.json",
    "musicTags.json",
    "musicVocals.json",
    "musics.json",
    "mysekaiBlueprintMysekaiMaterialCosts.json",
    "mysekaiBlueprints.json",
    "mysekaiCharacterTalkConditionGroups.json",
    "mysekaiCharacterTalkConditions.json",
    "mysekaiCharacterTalks.json",
    "mysekaiFixtureMainGenres.json",
    "mysekaiFixtureSubGenres.json",
    "mysekaiFixtureTags.json",
    "mysekaiFixtures.json",
    "mysekaiGameCharacterUnitGroups.json",
    "mysekaiGateLevels.json",
    "mysekaiMaterials.json",
    "mysekaiSites.json",
    "outsideCharacters.json",
    "resourceBoxDetails.json",
    "resourceBoxes.json",
    "shopItems.json",
    "skills.json",
    "specialStories.json",
    "stamps.json",
    "tips.json",
    "unitProfiles.json",
    "unitStories.json",
    "unitStoryEpisodeGroups.json",
    "virtualLives.json"
]

# Additional metadata files from moe.exmeaning.com
OTHER_METADATA_FILES = [
    "https://moe.exmeaning.com/mangas/mangas.json",
    "https://moe.exmeaning.com/guides/guides-index.json",
    "https://moe.exmeaning.com/data/event_bvid/events_bilibili.json",
    "https://moe.exmeaning.com/bgm/durations.json"
]

DOMAINS = ["metadata.exmeaning.com", "metadata.pjsk.moe"]
REGIONS = ["jp", "cn", "en", "tw", "kr"]

def fetch_url(url, timeout=20):
    """Fetches a URL using urllib, requests gzip content, and returns status, size, and time elapsed."""
    headers = {
        "User-Agent": "SnowyViewer-CacheWarmer/1.0 (Mozilla/5.0)",
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
    }
    req = urllib.request.Request(url, headers=headers)
    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            content = response.read()
            elapsed = time.time() - start_time
            
            # Decompress if content was gzipped
            if response.info().get("Content-Encoding") == "gzip":
                try:
                    content = gzip.decompress(content)
                except Exception:
                    pass # Keep raw if decompression fails
            
            size_kb = len(content) / 1024.0
            return {
                "url": url,
                "success": True,
                "status": response.status,
                "size_kb": size_kb,
                "elapsed": elapsed,
                "error": None
            }
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start_time
        return {
            "url": url,
            "success": False,
            "status": e.code,
            "size_kb": 0,
            "elapsed": elapsed,
            "error": str(e)
        }
    except Exception as e:
        elapsed = time.time() - start_time
        return {
            "url": url,
            "success": False,
            "status": 0,
            "size_kb": 0,
            "elapsed": elapsed,
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description="Snowy Viewer Masterdata Cache Warmer")
    parser.add_argument("--domains", nargs="+", default=DOMAINS, help="Domains to fetch from")
    parser.add_argument("--regions", nargs="+", default=REGIONS, help="Game regions/servers to fetch")
    parser.add_argument("--concurrency", type=int, default=10, help="Number of concurrent threads")
    parser.add_argument("--include-others", action="store_true", help="Include other metadata assets (mangas, guides, etc.)")
    args = parser.parse_args()

    urls = []
    
    # Generate URLs for version files and masterdata files
    for domain in args.domains:
        for region in args.regions:
            # 1. Version file
            urls.append(f"https://{domain}/{region}/versions/current_version.json")
            
            # 2. Masterdata files
            for file in MASTERDATA_FILES:
                urls.append(f"https://{domain}/{region}/master/{file}")

    if args.include_others:
        urls.extend(OTHER_METADATA_FILES)

    print(f"[*] Starting cache warming for {len(urls)} URLs...")
    print(f"[*] Target domains: {', '.join(args.domains)}")
    print(f"[*] Target regions: {', '.join(args.regions)}")
    print(f"[*] Concurrency limit: {args.concurrency} threads")
    print("-" * 80)

    success_count = 0
    fail_count = 0
    total_size_mb = 0.0
    start_all = time.time()

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        # Submit all tasks
        future_to_url = {executor.submit(fetch_url, url): url for url in urls}
        
        for future in concurrent.futures.as_completed(future_to_url):
            result = future.result()
            url_short = result["url"].replace("https://", "")
            
            if result["success"]:
                success_count += 1
                total_size_mb += result["size_kb"] / 1024.0
                print(f"[SUCCESS] {url_short} | HTTP {result['status']} | {result['size_kb']:.2f} KB | {result['elapsed']:.2f}s")
            else:
                fail_count += 1
                # Format print based on type of error (e.g. 404 is normal for some regions without certain files)
                if result["status"] == 404:
                    print(f"[NOT FOUND] {url_short} | HTTP 404 | {result['elapsed']:.2f}s")
                else:
                    print(f"[FAILED] {url_short} | Error: {result['error']} | {result['elapsed']:.2f}s")

    elapsed_all = time.time() - start_all
    print("-" * 80)
    print(f"[*] Cache Warming Complete!")
    print(f"[*] Total time: {elapsed_all:.2f}s")
    print(f"[*] Successful requests: {success_count}")
    print(f"[*] Failed/Not Found requests: {fail_count}")
    print(f"[*] Total downloaded size: {total_size_mb:.2f} MB")

if __name__ == "__main__":
    main()
