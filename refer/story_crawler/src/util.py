import os, json, asyncio, traceback, bisect, logging, re, shutil
from pathlib import Path
from enum import Enum
from typing import Any, Callable
from asyncio import Semaphore
from concurrent.futures import ThreadPoolExecutor

import aiohttp, brotli

SKIP_FETCH_ERROR = True


# https://github.com/EternalFlower/Project-Sekai-Story-Parser/blob/main/PJSekai%20Story%20parser.py
class SnippetAction(int, Enum):
    NoAction = 0
    Talk = 1
    CharacterLayout = 2
    InputName = 3
    CharacterMotion = 4
    Selectable = 5
    SpecialEffect = 6
    Sound = 7


# https://github.com/moe-sekai/Moesekai/blob/main/web/src/types/story.ts
class SpecialEffectType(int, Enum):
    NoEffect = 0
    BlackIn = 1
    BlackOut = 2
    WhiteIn = 3
    WhiteOut = 4
    ShakeScreen = 5
    ShakeWindow = 6
    ChangeBackground = 7
    Telop = 8
    FlashbackIn = 9
    FlashbackOut = 10
    ChangeCardStill = 11
    AmbientColorNormal = 12
    AmbientColorEvening = 13
    AmbientColorNight = 14
    PlayScenarioEffect = 15
    StopScenarioEffect = 16
    ChangeBackgroundStill = 17
    PlaceInfo = 18
    Movie = 19
    SekaiIn = 20
    SekaiOut = 21
    AttachCharacterShader = 22
    SimpleSelectable = 23
    FullScreenText = 24
    StopShakeScreen = 25
    StopShakeWindow = 26
    MemoryIn = 27
    MemoryOut = 28
    BlackWipeInLeft = 29
    BlackWipeOutLeft = 30
    BlackWipeInRight = 31
    BlackWipeOutRight = 32
    BlackWipeInTop = 33
    BlackWipeOutTop = 34
    BlackWipeInBottom = 35
    BlackWipeOutBottom = 36
    PlayMV = 37  # special, only in pjsk unit main story
    FullScreenTextShow = 38
    FullScreenTextHide = 39
    SekaiInCenter = 40
    SekaiOutCenter = 41
    ChangeCameraPosition = 42
    ChangeCameraZoomLevel = 43
    Blur = 44


Mark_multi_lang = {
    ':': {'cn': '：', 'en': ': '},
    '(': {'cn': '（', 'en': ' ('},
    ')': {'cn': '）', 'en': ')'},
    ',': {'cn': '、', 'en': ', '},
    '[': {'cn': '【', 'en': '['},
    ']': {'cn': '】', 'en': ']'},
    '<': {'cn': '《', 'en': '<'},
    '>': {'cn': '》', 'en': '>'},
    'characters': {'cn': '（登场角色：', 'en': '(Character: '},
    'place': {'cn': '（地点：', 'en': '(Place: '},
    'fullscreen text': {'cn': '（全屏幕文字）：', 'en': '(Fullscreen text): '},
    'selection': {'cn': '（选项：', 'en': '(Selection: '},
    'video': {'cn': '（播放视频：', 'en': '(Video: '},
    'mv': {'cn': '（播放MV：', 'en': '(Music video: '},
    'cg': {'cn': '（插入CG：', 'en': '(CG insert: '},
    'background': {'cn': '（背景切换）', 'en': '(Background change)'},
    'memory in': {'cn': '（回忆切入）', 'en': '(Memory cut-in)'},
    'memory out': {'cn': '（回忆切出）', 'en': '(Memory cut-out)'},
    'black out': {'cn': '（黑屏转场）', 'en': '(Black cut)'},
    'white out': {'cn': '（白屏转场）', 'en': '(White cut)'},
    'gacha phrase': {'cn': '抽卡台词：', 'en': 'Gacha phrase: '},
    'self intro': {'cn': '自我介绍：', 'en': 'Self introduction: '},
    'anime story': {'cn': '动画故事', 'en': 'Anime story'},
    'see main story': {'cn': '见主线故事', 'en': 'See in main story'},
    'see band story': {'cn': '见乐队故事', 'en': 'See in band story'},
}


_net_semaphore = asyncio.Semaphore(20)
_MISSING_FILE = object()

_compress_executor = ThreadPoolExecutor(max_workers=min(8, (os.cpu_count() or 4)))


def _compress_sync(json_bytes: bytes, quality: int) -> bytes:
    return brotli.compress(json_bytes, quality=quality)


def _decompress_sync(compressed_bytes: bytes) -> bytes:
    return brotli.decompress(compressed_bytes)


class Base_fetcher:
    def __init__(
        self,
        assets_save_dir: str,
        online: bool,
        save_assets: bool,
        missing_download: bool,
        compress_assets: bool,
        force_master_online: bool,
    ):
        self.assets_save_dir = assets_save_dir
        self.online = online
        self.save_assets = save_assets
        self.missing_download = missing_download
        self.compress_assets = compress_assets
        self.force_master_online = force_master_online

    async def init(
        self,
        session: aiohttp.ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
    ) -> None:
        self.session = session

        if network_semaphore is None:
            self.network_semaphore = _net_semaphore
        else:
            self.network_semaphore = network_semaphore

    async def fetch_url_json(
        self,
        url: str | list[str],
        extra_record_msg: str = '',
        print_done: bool = False,
        append_save_path: str | None = None,
        compress: bool = False,
        force_online: bool = False,
        skip_read: bool = False,
        content_save_edit: Callable | None = None,
    ) -> Any:
        return await fetch_url_json(
            url,
            self.online | force_online,
            self.save_assets,
            self.assets_save_dir,
            self.missing_download,
            extra_record_msg=extra_record_msg,
            session=self.session,
            network_semaphore=self.network_semaphore,
            print_done=print_done,
            append_save_path=append_save_path,
            compress=compress,
            skip_read=skip_read,
            content_save_edit=content_save_edit,
        )


class Base_getter(Base_fetcher):
    def __init__(
        self,
        save_dir: str,
        assets_save_dir: str,
        online: bool,
        save_assets: bool,
        parse: bool,
        missing_download: bool,
        compress_assets: bool,
        force_master_online: bool,
    ):
        super().__init__(
            assets_save_dir,
            online,
            save_assets,
            missing_download,
            compress_assets,
            force_master_online,
        )

        self.save_dir = save_dir
        self.parse = parse


class DictLookup:
    def __init__(self, data: list[dict[str, Any]], attr_name: str):
        self.data = data
        self.ids = [int(d[attr_name]) for d in data]

    def find_index(self, target_id: int) -> int:
        left_index = bisect.bisect_left(self.ids, target_id)
        if left_index < len(self.ids) and self.ids[left_index] == target_id:
            return left_index
        return -1

    def find_max_le_index(self, target_id: int) -> int:
        insert_pos = bisect.bisect_right(self.ids, target_id)
        if insert_pos == 0:
            return -1
        return insert_pos - 1


def valid_filename(filename: str) -> str:
    return (
        filename.strip()
        .replace('*', '＊')
        .replace(':', '：')
        .replace('/', '／')
        .replace('\\', '＼')
        .replace('?', '？')
        .replace('"', "''")
        .replace('\n', ' ')
    )


def url_to_path(url: str, save_dir: str) -> str:
    url_path = url[url.index('//') + 2 :]
    return os.path.normpath(os.path.join(save_dir, url_path))


def write_to_file(file_path: str, content: str) -> None:
    with open(file_path, 'a', encoding='utf-8') as f:
        f.write(f"{content}\n")


async def save_json_to_url(
    url: str,
    content: Any,
    save_dir: str,
    append_save_path: str | None,
    compress: bool,
    content_edit: Callable | None,
) -> None:
    if append_save_path is None:
        path = url_to_path(url, save_dir)
    else:
        path = os.path.normpath(os.path.join(save_dir, append_save_path))
    os.makedirs(os.path.split(path)[0], exist_ok=True)

    if content_edit is not None:
        content = content_edit(content)

    if compress:
        json_bytes = json.dumps(content, ensure_ascii=False).encode('utf-8')
        loop = asyncio.get_event_loop()
        compressed = await loop.run_in_executor(
            _compress_executor, _compress_sync, json_bytes, 11
        )
        with open(path + '.br', 'wb') as f:
            f.write(compressed)
    else:
        with open(path, 'w', encoding='utf8') as f:
            f.write(json.dumps(content, ensure_ascii=False, indent=2))


async def read_json_from_url(
    urls: list[str],
    missing_download: bool,
    save_dir: str,
    extra_record_msg: str,
    error_assets_file: str | None,
    missing_assets_file: str | None,
    session: aiohttp.ClientSession | None,
    network_semaphore: Semaphore,
    append_save_path: str | None,
    compress: bool,
    skip_read: bool,
) -> Any:
    for url in urls:
        if append_save_path is None:
            path = url_to_path(url, save_dir)
        else:
            path = os.path.normpath(os.path.join(save_dir, append_save_path))
        if os.path.exists(path):
            if skip_read:
                return 'ERROR: skip read'
            async with network_semaphore:
                with open(path, encoding='utf8') as f:
                    content = f.read()
                    return json.loads(content)
        elif os.path.exists(path + '.br'):
            if skip_read:
                return 'ERROR: skip read'
            async with network_semaphore:
                with open(path + '.br', 'rb') as f:
                    compressed_bytes = f.read()
                    loop = asyncio.get_event_loop()
                    decompressed_bytes = await loop.run_in_executor(
                        _compress_executor, _decompress_sync, compressed_bytes
                    )
                    content = decompressed_bytes.decode("utf-8")
                    return json.loads(content)

    if missing_download:
        return await fetch_url_json(
            urls,
            True,
            True,
            save_dir,
            False,
            extra_record_msg,
            error_assets_file,
            missing_assets_file,
            session,
            network_semaphore,
            append_save_path=append_save_path,
            compress=compress,
            skip_read=skip_read,
        )
    else:
        if missing_assets_file:
            write_to_file(
                missing_assets_file,
                f"{extra_record_msg}{': ' if extra_record_msg else ''}{', '.join(urls)}",
            )
        return _MISSING_FILE


async def fetch_url_json(
    url: str | list[str],
    online: bool,
    save: bool,
    save_dir: str,
    missing_download: bool,
    extra_record_msg: str = '',
    error_assets_file: str | None = 'assets_error.log',
    missing_assets_file: str | None = 'assets_missing.log',
    session: aiohttp.ClientSession | None = None,
    network_semaphore: Semaphore | None = None,
    print_done: bool = False,
    append_save_path: str | None = None,
    max_retries: int = 5,
    compress: bool = False,
    skip_read: bool = False,
    content_save_edit: Callable | None = None,
) -> Any:

    if network_semaphore is None:
        network_semaphore = _net_semaphore

    urls = [url] if isinstance(url, str) else url

    if online:
        assert session is not None

        json_content = None
        last_error = None

        for current_url in urls:
            for attempt in range(max_retries):
                async with network_semaphore:
                    try:
                        async with session.get(current_url) as res:
                            res.raise_for_status()
                            json_content = await res.json(content_type=None)
                            last_error = None
                            break

                    except Exception as e:
                        last_error = f'ERROR: Fetch json error, attempt {attempt + 1}/{max_retries}, url: {current_url}, {traceback.format_exc()}'.strip()
                        no_retry = (
                            isinstance(e, aiohttp.ClientResponseError)
                            and 400 <= e.status < 500
                        )
                        if no_retry or attempt + 1 == max_retries:
                            logging.warning(last_error)
                        if no_retry:
                            break

            if last_error is None:
                if save:
                    await save_json_to_url(
                        current_url,
                        json_content,
                        save_dir,
                        append_save_path,
                        compress,
                        content_save_edit,
                    )
                break

        if last_error is not None:
            json_content = last_error
            if error_assets_file:
                failed_urls = ', '.join(urls)
                write_to_file(
                    error_assets_file,
                    f"{extra_record_msg}{': ' if extra_record_msg else ''}{failed_urls}",
                )

    else:  # offline
        result = await read_json_from_url(
            urls,
            missing_download,
            save_dir,
            extra_record_msg,
            error_assets_file,
            missing_assets_file,
            session,
            network_semaphore,
            append_save_path,
            compress,
            skip_read,
        )
        json_content = 'Unable to read json file' if result is _MISSING_FILE else result

    if print_done:
        logging.info('fetch ' + (urls[0] if len(urls) == 1 else str(urls)) + ' done.')

    return json_content


def judge_need_skip(*story_json: dict | str) -> bool:
    return SKIP_FETCH_ERROR and any(
        isinstance(json_str, str) and json_str.startswith('ERROR:')
        for json_str in story_json
    )


def delete_path(path: str) -> None:
    if not os.path.exists(path):
        return
    if os.path.isdir(path):
        shutil.rmtree(path)
    else:
        os.unlink(path)


def remove_leading_zeros(s: str) -> str:
    '''
    001 → 1，001-02 → 1-2，000 → 0，012abc034 → 12abc34
    '''

    def process_digit(match: re.Match):
        digit_str: str = match.group()
        return digit_str.lstrip('0') or '0'

    return re.sub(r'\d+', process_digit, s)


def remove_olds_or_rename_old(new_path_: str | Path, name_index_reg: str) -> None:
    '''
    make sure new_path's parent exist
    '''
    new_path = Path(new_path_)
    index_match = re.match(name_index_reg, new_path.name)

    assert index_match is not None
    new_index = index_match.group(1)

    old_paths = [
        p
        for p in Path(new_path.parent).iterdir()
        if (
            (match := re.match(name_index_reg, p.name))
            and (
                remove_leading_zeros(match.group(1)) == remove_leading_zeros(new_index)
            )
        )
    ]

    if len(old_paths) == 0:
        return
    elif len(old_paths) == 1:
        if old_paths[0] != new_path:
            old_paths[0].rename(new_path)
            logging.warning(f'Rename: {old_paths[0]} -> {new_path}')
    else:
        for p in old_paths:
            if p != new_path:
                delete_path(str(p))
                logging.warning(f'Delete: {p}')
