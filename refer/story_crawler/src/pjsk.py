import os, math, asyncio, json, re, time, logging
from pathlib import Path
from asyncio import Semaphore
from typing import Any, Callable, Optional, cast

import aiofiles
from aiohttp import ClientSession, TCPConnector

from . import util
from .util import Mark_multi_lang


class Constant:
    unit_code_abbr = {
        'light_sound': 'Ln',
        'idol': 'MMJ',
        'street': 'VBS',
        'theme_park': 'WxS',
        'school_refusal': 'N25',
        'piapro': 'VS',
        'none': 'none',
        'mix': 'Mix',
    }

    rarity_name = {
        'rarity_1': 'R1',
        'rarity_2': 'R2',
        'rarity_3': 'R3',
        'rarity_4': 'R4',
        'rarity_birthday': 'RB',
    }

    @staticmethod
    def is_cg(pic_name: str) -> bool:
        if pic_name[:4] == 'bg_a' and (1 <= int(pic_name[4:]) <= 99):
            return True
        elif pic_name[:4] == 'bg_s':
            return True
        else:
            return False

    urls: dict[str, dict[str, Any]] = json.load(
        open(Path(__file__).parent / 'urls_pjsk.json', encoding='utf8')
    )

    @staticmethod
    def get_srcs_url(
        lang: str, srcs: list[str], file_type: str, file: str
    ) -> list[str]:
        '''
        lang: cn jp tw

        file_type: master or asset
        '''
        base_urls = []
        for src in srcs:
            if file_type == 'master':
                base_url: str = Constant.urls[src]['master']
                base_urls.append(
                    base_url.format(
                        lang=Constant.urls[src]['master_lang'][lang], file=file
                    )
                )
            else:
                base_url = Constant.urls[src][f'{file}_asset']
                base_urls.append(
                    base_url.format(lang=Constant.urls[src]['asset_lang'][lang])
                )
        return base_urls


class Pjsk_fetcher(util.Base_fetcher):
    @staticmethod
    def __url_to_apd_path_master(url: str, lang: str) -> str:
        master_name_match = re.search(r'master.*/(\w+\.json)', url)
        if master_name_match:
            master_name = master_name_match.group(1)
        else:
            raise RuntimeError(url)
        return os.path.normpath(os.path.join(f'pjsk-{lang}-master', master_name))

    @staticmethod
    def __url_to_apd_path_asset(url: str, lang: str) -> str:
        asset_name_match = re.search(r'(ondemand|startapp|sekai-\w+-assets)/(.*)', url)
        if asset_name_match:
            asset_name = asset_name_match.group(2)
        else:
            raise RuntimeError(url)
        return os.path.normpath(os.path.join(f'pjsk-{lang}-assets', asset_name))

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
        lang_for_path: str | None = None,
    ) -> Any:
        assert append_save_path is None

        lang_for_path = (
            lang_for_path
            or getattr(getattr(self, 'reader', None), 'lang', None)
            or getattr(self, 'lang', None)
        )
        assert lang_for_path is not None

        urls = [url] if isinstance(url, str) else url

        master_name_match = re.search(r'master.*/(\w+\.json)', urls[0])
        if master_name_match:
            append_save_path = Pjsk_fetcher.__url_to_apd_path_master(
                urls[0], lang_for_path
            )
        else:
            append_save_path = Pjsk_fetcher.__url_to_apd_path_asset(
                urls[0], lang_for_path
            )

        return await super().fetch_url_json(
            url,
            extra_record_msg,
            print_done,
            append_save_path=append_save_path,
            compress=compress,
            force_online=force_online,
            skip_read=skip_read,
            content_save_edit=content_save_edit,
        )


class Pjsk_getter(Pjsk_fetcher, util.Base_getter):
    pass


class Story_reader(Pjsk_fetcher):
    def __init__(
        self,
        lang: str = 'cn',
        src: list[str] = ['haruki', 'sekai.best'],
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        missing_download: bool = True,
        mark_lang: str = 'cn',
        debug_parse: bool = False,
        cg_add_link: bool = True,
        force_master_online: bool = False,
        **args,
    ) -> None:
        super().__init__(
            assets_save_dir,
            online,
            save_assets,
            missing_download,
            False,
            force_master_online,
        )

        self.lang = lang
        self.mark_lang = mark_lang
        self.debug_parse = debug_parse
        self.cg_add_link = cg_add_link

        self.cg_link = 'https://sekai-assets-bdf29c81.seiunx.net/jp-assets/ondemand/scenario/background/{pic_name}/{pic_name}.png'

        self.gameCharacters_url = Constant.get_srcs_url(
            lang, src, 'master', 'gameCharacters'
        )
        self.character2ds_url = Constant.get_srcs_url(
            lang, src, 'master', 'character2ds'
        )

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
        file_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore, file_semaphore)

        self.gameCharacters, self.character2ds = await asyncio.gather(
            self.fetch_url_json(
                self.gameCharacters_url, force_online=self.force_master_online
            ),
            self.fetch_url_json(
                self.character2ds_url, force_online=self.force_master_online
            ),
        )

        self.gameCharacters_lookup = util.DictLookup(self.gameCharacters, 'id')
        self.character2ds_lookup = util.DictLookup(self.character2ds, 'id')

    def get_chara_unitAbbr_names(self, chara_id: int) -> tuple[str, str, str]:
        profile_index = self.gameCharacters_lookup.find_index(chara_id)
        assert profile_index != -1
        profile: dict[str, Any] = self.gameCharacters[profile_index]
        first_name = profile.get('firstName')
        givenName = profile['givenName']
        full_name = first_name + givenName if first_name is not None else givenName

        unit_abbr = Constant.unit_code_abbr[profile['unit']]
        return (unit_abbr, full_name, givenName)

    def get_chara2d_unitAbbr_names_isVS(
        self, chara2dId: int
    ) -> tuple[str, str, str, bool]:
        chara2d = self.character2ds[self.character2ds_lookup.find_index(chara2dId)]
        if chara2d['characterType'] != 'game_character':
            return '', '', '', False
        actual_unit = chara2d['unit']
        chara_id = chara2d['characterId']
        chara_unit, fullname, givenname = self.get_chara_unitAbbr_names(chara_id)
        if chara_unit != 'VS':
            return chara_unit, fullname, givenname, False
        else:
            return Constant.unit_code_abbr[actual_unit], fullname, givenname, True

    def read_story_in_json(self, json_data: str | dict[str, Any]) -> str:
        if isinstance(json_data, str):
            return json_data

        talks = json_data['TalkData']
        specialEffects = json_data['SpecialEffectData']

        appearCharacters = json_data['AppearCharacters']
        chara_id = set()

        for chara in appearCharacters:
            chara2dId = chara['Character2dId']
            chara2d = self.character2ds[self.character2ds_lookup.find_index(chara2dId)]
            if chara2d['characterType'] == 'game_character':
                chara_id.add(chara2d['characterId'])
        chara_id_list = sorted(chara_id)

        if len(chara_id_list) > 0:
            ret0 = (
                Mark_multi_lang['characters'][self.mark_lang]
                + Mark_multi_lang[','][self.mark_lang].join(
                    [self.get_chara_unitAbbr_names(id)[1] for id in chara_id_list]
                )
                + Mark_multi_lang[')'][self.mark_lang]
            )
        else:
            ret0 = ''

        snippets = json_data['Snippets']
        next_talk_need_newline = True

        ret = ''
        for snippet in snippets:
            snippet_index = snippet['Index']
            if self.debug_parse:
                ret += f"{snippet_index},{snippet['ReferenceIndex']},"

            if snippet['Action'] == util.SnippetAction.SpecialEffect:
                specialEffect = specialEffects[snippet['ReferenceIndex']]
                if specialEffect['EffectType'] == util.SpecialEffectType.Telop:
                    ret += (
                        '\n'
                        + Mark_multi_lang['['][self.mark_lang]
                        + specialEffect['StringVal']
                        + Mark_multi_lang[']'][self.mark_lang]
                        + '\n'
                    )
                    next_talk_need_newline = True
                elif specialEffect['EffectType'] == util.SpecialEffectType.PlaceInfo:
                    if next_talk_need_newline:
                        ret += '\n'
                    ret += f"{Mark_multi_lang['place'][self.mark_lang]}{specialEffect['StringVal']}{Mark_multi_lang[')'][self.mark_lang]}\n"
                    next_talk_need_newline = False
                elif (
                    specialEffect['EffectType'] == util.SpecialEffectType.FullScreenText
                ):
                    if next_talk_need_newline:
                        ret += '\n'
                    ret += (
                        Mark_multi_lang['fullscreen text'][self.mark_lang]
                        + specialEffect['StringVal'].replace('\n', ' ')
                        + '\n'
                    )
                    next_talk_need_newline = False
                elif (
                    specialEffect['EffectType']
                    == util.SpecialEffectType.SimpleSelectable
                ):
                    if next_talk_need_newline:
                        ret += '\n'
                    ret += f"{Mark_multi_lang['selection'][self.mark_lang]}{specialEffect['StringVal']}{Mark_multi_lang[')'][self.mark_lang]}\n"
                    next_talk_need_newline = False
                elif specialEffect['EffectType'] == util.SpecialEffectType.Movie:
                    if next_talk_need_newline:
                        ret += '\n'
                    ret += f"{Mark_multi_lang['video'][self.mark_lang]}{specialEffect['StringVal']}{Mark_multi_lang[')'][self.mark_lang]}\n"
                    next_talk_need_newline = False
                elif specialEffect['EffectType'] == util.SpecialEffectType.PlayMV:
                    if next_talk_need_newline:
                        ret += '\n'
                    ret += f"{Mark_multi_lang['mv'][self.mark_lang]}{specialEffect['IntVal']}{Mark_multi_lang[')'][self.mark_lang]}\n"
                    next_talk_need_newline = False
                elif (
                    specialEffect['EffectType']
                    == util.SpecialEffectType.ChangeBackground
                ):
                    if next_talk_need_newline:
                        ret += '\n'
                    pic_name = specialEffect['StringVal']
                    if Constant.is_cg(pic_name):
                        if not self.cg_add_link:
                            ret += f"{Mark_multi_lang['cg'][self.mark_lang]}{pic_name}{Mark_multi_lang[')'][self.mark_lang]}\n"
                        else:
                            ret += f"{Mark_multi_lang['cg'][self.mark_lang]}{self.cg_link.format(pic_name=pic_name)}{Mark_multi_lang[')'][self.mark_lang]}\n"
                    else:
                        ret += (
                            Mark_multi_lang['background'][self.mark_lang]
                            + (f': {pic_name}' if self.debug_parse else '')
                            + '\n'
                        )
                    next_talk_need_newline = False
                elif specialEffect['EffectType'] == util.SpecialEffectType.FlashbackIn:
                    ret += '\n' + Mark_multi_lang['memory in'][self.mark_lang] + '\n'
                    next_talk_need_newline = True
                elif specialEffect['EffectType'] == util.SpecialEffectType.FlashbackOut:
                    ret += '\n' + Mark_multi_lang['memory out'][self.mark_lang] + '\n'
                    next_talk_need_newline = True
                elif specialEffect['EffectType'] == util.SpecialEffectType.BlackOut:
                    if next_talk_need_newline:
                        ret += '\n'
                    ret += Mark_multi_lang['black out'][self.mark_lang] + '\n'
                    next_talk_need_newline = False
                elif specialEffect['EffectType'] == util.SpecialEffectType.WhiteOut:
                    if next_talk_need_newline:
                        ret += '\n'
                    ret += Mark_multi_lang['white out'][self.mark_lang] + '\n'
                    next_talk_need_newline = False
                else:
                    if self.debug_parse:
                        try:
                            effect_name = util.SpecialEffectType(
                                specialEffect['EffectType']
                            ).name
                        except ValueError:
                            effect_name = specialEffect['EffectType']
                        ret += f"SpecialEffect-{effect_name}: {specialEffect}\n"

            elif snippet['Action'] == util.SnippetAction.Talk:
                talk = talks[snippet['ReferenceIndex']]

                talk_chara2did = talk['TalkCharacters'][0]['Character2dId']
                unit, speaker_fullname, speaker_shortname, isVS = (
                    self.get_chara2d_unitAbbr_names_isVS(talk_chara2did)
                )
                if isVS and unit not in (
                    'VS',
                    'none',
                ):  # none for some VS in chara2D, like card 335
                    need_unit_annotation = True
                else:
                    need_unit_annotation = False

                displayname = talk['WindowDisplayName'].replace('\n', ' ')

                if len(speaker_fullname) > 0 and (
                    displayname not in (speaker_fullname, speaker_shortname)
                ):
                    name = (
                        displayname
                        + util.Mark_multi_lang['('][self.mark_lang]
                        + speaker_shortname
                        + (f'-{unit}' if need_unit_annotation else '')
                        + util.Mark_multi_lang[')'][self.mark_lang]
                    )
                else:
                    name = displayname + (
                        (
                            util.Mark_multi_lang['('][self.mark_lang]
                            + unit
                            + util.Mark_multi_lang[')'][self.mark_lang]
                        )
                        if need_unit_annotation
                        else ''
                    )

                if next_talk_need_newline:
                    ret += '\n'
                ret += (
                    name
                    + Mark_multi_lang[':'][self.mark_lang]
                    + talk['Body'].replace('\n', ' ')
                    + '\n'
                )
                next_talk_need_newline = False
            else:
                if self.debug_parse:
                    try:
                        snippet_name = util.SnippetAction(snippet['Action']).name
                    except ValueError:
                        snippet_name = snippet['Action']
                    ret += f"{snippet_name}\n"

        return (ret0 + '\n\n' + ret.strip()).strip()


class Event_story_getter(Pjsk_getter):
    def __init__(
        self,
        reader: Story_reader,
        src: list[str] = ['haruki', 'sekai.best'],
        save_dir: str = './story_event',
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        parse: bool = True,
        missing_download: bool = True,
        maxlen_eventId_episode: tuple[int, int] = (3, 2),
        compress_assets: bool = False,
        force_master_online: bool = False,
    ) -> None:
        '''
        src: sekai.best or pjsk.moe
        '''

        super().__init__(
            save_dir,
            assets_save_dir,
            online,
            save_assets,
            parse,
            missing_download,
            compress_assets,
            force_master_online,
        )

        self.reader = reader

        self.maxlen_eventId_episode = maxlen_eventId_episode

        self.events_url = Constant.get_srcs_url(
            self.reader.lang, src, 'master', 'events'
        )
        self.eventStories_url = Constant.get_srcs_url(
            self.reader.lang, src, 'master', 'eventStories'
        )
        self.gameCharacterUnits_url = Constant.get_srcs_url(
            self.reader.lang,
            src,
            'master',
            'gameCharacterUnits',
        )
        self.event_asset_url = Constant.get_srcs_url(
            self.reader.lang, src, 'asset', 'event'
        )

        self.actionSets_url = Constant.get_srcs_url('jp', src, 'master', 'actionSets')

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
        file_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore, file_semaphore)

        (
            self.events_json,
            self.eventStories_json,
            self.gameCharacterUnits,
            actionSets,
        ) = await asyncio.gather(
            self.fetch_url_json(self.events_url, force_online=self.force_master_online),
            self.fetch_url_json(
                self.eventStories_url, force_online=self.force_master_online
            ),
            self.fetch_url_json(
                self.gameCharacterUnits_url, force_online=self.force_master_online
            ),
            self.fetch_url_json(
                self.actionSets_url,
                lang_for_path='jp',
                force_online=self.force_master_online,
            ),
        )

        self.events_lookup = util.DictLookup(self.events_json, 'id')
        self.eventStories_lookup = util.DictLookup(self.eventStories_json, 'eventId')
        self.gameCharacterUnits_lookup = util.DictLookup(self.gameCharacterUnits, 'id')

        self.event_type_map = Event_story_getter.__get_event_type_map(actionSets)

    @staticmethod
    def __get_event_type_map(actionSets: list[dict[str, Any]]) -> dict[int, str]:
        ret = {}

        ret[1] = 'band'
        ret[5] = 'idol'
        ret[6] = 'street'
        ret[9] = 'shuffle'

        for action in actionSets:
            releaseConditionId = str(action['releaseConditionId'])
            is_event = (
                ('scenarioId' in action)
                and (
                    'areatalk_ev' in action['scenarioId']
                    or 'areatalk_wl' in action['scenarioId']
                )
                and (len(releaseConditionId) == 6)
                and (releaseConditionId[0] == '1')
            )
            if is_event:
                event_id = int(releaseConditionId[1:4]) + 1
                scenarioId: str = action['scenarioId']
                event_type = scenarioId.split('_')[2]
                is_wl = scenarioId.split('_')[1] == 'wl'
                if event_id not in ret:
                    if False and is_wl:
                        ret[event_id] = event_type + '_' + 'wl'
                    else:
                        ret[event_id] = event_type
        return ret

    __type_str_code_map = {
        'band': 'light_sound',
        'idol': 'idol',
        'street': 'street',
        'wonder': 'theme_park',
        'night': 'school_refusal',
        'piapro': 'piapro',
    }

    def get_event_unit_abbr(self, event_id: int) -> str:
        type_str = self.event_type_map[event_id]
        return Constant.unit_code_abbr[
            Event_story_getter.__type_str_code_map.get(type_str, 'mix')
        ]

    async def get(self, event_id: int) -> None:

        event_index = self.events_lookup.find_index(event_id)
        eventStory_index = self.eventStories_lookup.find_index(event_id)

        if (event_index == -1) or (eventStory_index == -1):
            logging.info(f'event {event_id} does not exist.')
            return

        event = self.events_json[event_index]
        eventStory: dict[str, Any] = self.eventStories_json[eventStory_index]

        event_name = event['name']
        event_type = event['eventType']
        # event_unit = event['unit']
        assetbundleName = event['assetbundleName']
        banner_chara_unit_id = eventStory.get('bannerGameCharacterUnitId')
        event_outline = eventStory['outline'].replace('\n', ' ')

        event_unit_abbr = self.get_event_unit_abbr(event_id)

        if event_type == 'world_bloom':
            banner_name = f'{event_unit_abbr}_WL'
        else:
            assert banner_chara_unit_id is not None
            banner_chara_unit_index = self.gameCharacterUnits_lookup.find_index(
                banner_chara_unit_id
            )
            assert banner_chara_unit_index != -1
            chara_unit, banner_chara_name, _ = self.reader.get_chara_unitAbbr_names(
                self.gameCharacterUnits[banner_chara_unit_index]['gameCharacterId']
            )
            if chara_unit == 'VS':
                banner_chara_name += (
                    '-'
                    + Constant.unit_code_abbr[
                        self.gameCharacterUnits[banner_chara_unit_index]['unit']
                    ]
                )
            banner_name = f'{event_unit_abbr}_{banner_chara_name}'

        save_folder_name = util.valid_filename(
            f'{event_id:0{self.maxlen_eventId_episode[0]}} {event_name} ({banner_name})'
        )

        save_folder_name = self.reader.lang + '-' + save_folder_name

        event_save_dir = os.path.join(self.save_dir, save_folder_name)
        if self.parse:
            os.makedirs(event_save_dir, exist_ok=True)

        tasks = []
        for episode in eventStory['eventStoryEpisodes']:
            tasks.append(
                self.__get_episode(
                    episode,
                    event_type,
                    assetbundleName,
                    event_save_dir,
                    event_outline,
                    event_id,
                    event_name,
                )
            )
        await asyncio.gather(*tasks)

    async def __get_episode(
        self,
        episode: dict[str, Any],
        event_type: str,
        assetbundleName: str,
        event_save_dir: str,
        event_outline: str,
        event_id: int,
        event_name: str,
    ) -> None:
        episode_name = (
            f"{episode['eventStoryId']}-{episode['episodeNo']} {episode['title']}"
        )
        episode_save_name = util.valid_filename(
            f"{episode['eventStoryId']:0{self.maxlen_eventId_episode[0]}}-{episode['episodeNo']:0{self.maxlen_eventId_episode[1]}} {episode['title']}"
        )

        if event_type == 'world_bloom':
            gameCharacterId = episode.get('gameCharacterId', -1)
            if gameCharacterId != -1:
                chara_name = self.reader.get_chara_unitAbbr_names(gameCharacterId)[1]
                episode_name += f" ({chara_name})"
                episode_save_name = util.valid_filename(
                    episode_save_name + f" ({chara_name})"
                )

        scenarioId = episode['scenarioId']

        story_json: dict[str, Any] = await self.fetch_url_json(
            [
                url.format(assetbundleName=assetbundleName, scenarioId=scenarioId)
                for url in self.event_asset_url
            ],
            compress=self.compress_assets,
            skip_read=not self.parse,
        )

        if self.parse and not util.judge_need_skip(story_json):
            text = self.reader.read_story_in_json(story_json)

            async with self.file_semaphore:
                async with aiofiles.open(
                    os.path.join(event_save_dir, episode_save_name) + '.txt',
                    'w',
                    encoding='utf8',
                ) as f:
                    if episode['episodeNo'] == 1:
                        await f.write(event_outline + '\n\n')
                    await f.write(episode_name + '\n\n')
                    await f.write(text + '\n')

        logging.info(f'get event {event_id} {event_name} {episode_name} done.')

    async def get_newest(
        self,
        quantity: int = 10,
        timestamp13: int | None = None,
        area_getter: Optional['Area_talk_getter'] = None,
    ) -> None:
        '''
        quantity 0 = all
        '''
        if timestamp13 is None:
            timestamp13 = int(time.time() * 1000)

        old_events: list[tuple[int, int]] = []

        for event in self.events_json:
            if event['startAt'] <= timestamp13:
                old_events.append((event['startAt'], event['id']))

        new_events = sorted(old_events)[-quantity:]
        new_eventids = [x[1] for x in new_events]

        tasks = []
        for i in new_eventids:
            tasks.append(self.get(i))
            if area_getter is not None:
                tasks.append(area_getter.get(i))
        await asyncio.gather(*tasks)


class Unit_story_getter(Pjsk_getter):
    def __init__(
        self,
        reader: Story_reader,
        src: list[str] = ['haruki', 'sekai.best'],
        save_dir: str = './story_unit',
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        parse: bool = True,
        missing_download: bool = True,
        compress_assets: bool = False,
        force_master_online: bool = False,
    ) -> None:

        super().__init__(
            save_dir,
            assets_save_dir,
            online,
            save_assets,
            parse,
            missing_download,
            compress_assets,
            force_master_online,
        )

        self.reader = reader

        self.unitProfiles_url = Constant.get_srcs_url(
            self.reader.lang, src, 'master', 'unitProfiles'
        )

        self.unitStoryEpisodeGroups_url = Constant.get_srcs_url(
            self.reader.lang, src, 'master', 'unitStoryEpisodeGroups'
        )

        self.unitStories_url = Constant.get_srcs_url(
            self.reader.lang, src, 'master', 'unitStories'
        )
        self.unit_asset_url = Constant.get_srcs_url(
            self.reader.lang, src, 'asset', 'unit'
        )

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
        file_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore, file_semaphore)

        (
            self.unitProfiles_json,
            self.unitStoryEpisodeGroups_json,
            self.unitStories_json,
        ) = await asyncio.gather(
            self.fetch_url_json(
                self.unitProfiles_url, force_online=self.force_master_online
            ),
            self.fetch_url_json(
                self.unitStoryEpisodeGroups_url, force_online=self.force_master_online
            ),
            self.fetch_url_json(
                self.unitStories_url, force_online=self.force_master_online
            ),
        )

        self.unitStoryEpisodeGroups_lookup = util.DictLookup(
            self.unitStoryEpisodeGroups_json, 'id'
        )

    async def get(self, unit_id: int) -> None:
        for unitProfile in self.unitProfiles_json:
            if unitProfile['seq'] == unit_id:
                unitName = unitProfile['unitName']
                unitCode = unitProfile['unit']
                break
        else:
            logging.info(f'unit {unit_id} does not exist.')
            return

        for unitStory in self.unitStories_json:
            if unitStory['seq'] == unit_id:
                assetbundleName = unitStory['chapters'][0]['assetbundleName']
                episodes = unitStory['chapters'][0]['episodes']
                break
        else:
            logging.info(f'unit {unit_id} does not exist.')
            return

        save_folder_name = util.valid_filename(
            self.reader.lang + '-' + f'{unit_id} {unitName}'
        )

        unit_save_dir = os.path.join(self.save_dir, save_folder_name)
        if self.parse:
            os.makedirs(unit_save_dir, exist_ok=True)

        tasks = []
        for episode in episodes:
            tasks.append(
                self.__get_episode(
                    episode,
                    assetbundleName,
                    unit_save_dir,
                    unit_id,
                    unitName,
                    unitCode,
                )
            )
        await asyncio.gather(*tasks)

    async def __get_episode(
        self,
        episode: dict[str, Any],
        assetbundleName: str,
        unit_save_dir: str,
        unit_id: int,
        unitName: str,
        unitCode: str,
    ) -> None:
        scenarioId: str = episode['scenarioId']
        episode_name = f"{scenarioId} {episode['title']}"

        if unitCode != 'piapro' and episode['episodeNo'] == 1:
            need_outline = True
        elif unitCode == 'piapro' and int(scenarioId.split('_')[-1]) == 1:
            need_outline = True
        else:
            need_outline = False

        if need_outline:
            unitStoryEpisodeGroupId = episode['unitStoryEpisodeGroupId']
            unit_outline = self.unitStoryEpisodeGroups_json[
                self.unitStoryEpisodeGroups_lookup.find_index(unitStoryEpisodeGroupId)
            ]['outline'].replace('\n', ' ')
        else:
            unit_outline = None

        episode_save_name = util.valid_filename(episode_name)

        story_json: dict[str, Any] = await self.fetch_url_json(
            [
                url.format(assetbundleName=assetbundleName, scenarioId=scenarioId)
                for url in self.unit_asset_url
            ],
            compress=self.compress_assets,
            skip_read=not self.parse,
        )

        if self.parse and not util.judge_need_skip(story_json):
            text = self.reader.read_story_in_json(story_json)

            async with self.file_semaphore:
                async with aiofiles.open(
                    os.path.join(unit_save_dir, episode_save_name) + '.txt',
                    'w',
                    encoding='utf8',
                ) as f:
                    if unit_outline is not None:
                        await f.write(unit_outline + '\n\n')
                    await f.write(episode_name + '\n\n')
                    await f.write(text + '\n')

        logging.info(f'get unit {unit_id} {unitName} {episode_name} done.')

    def tell_ids(self) -> list[int]:
        ret = []
        for unitProfile in self.unitProfiles_json:
            ret.append(unitProfile['seq'])
        return ret


class Card_story_getter(Pjsk_getter):
    def __init__(
        self,
        reader: Story_reader,
        src: list[str] = ['haruki', 'sekai.best'],
        save_dir: str = './story_card',
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        parse: bool = True,
        missing_download: bool = True,
        maxlen_id: int = 4,
        compress_assets: bool = False,
        force_master_online: bool = False,
    ) -> None:

        super().__init__(
            save_dir,
            assets_save_dir,
            online,
            save_assets,
            parse,
            missing_download,
            compress_assets,
            force_master_online,
        )

        self.reader = reader
        self.maxlen_id = maxlen_id

        self.cards_url = Constant.get_srcs_url(self.reader.lang, src, 'master', 'cards')
        self.cardEpisodes_url = Constant.get_srcs_url(
            self.reader.lang, src, 'master', 'cardEpisodes'
        )
        self.eventCards_url = Constant.get_srcs_url(
            self.reader.lang, src, 'master', 'eventCards'
        )
        self.card_asset_url = Constant.get_srcs_url(
            self.reader.lang, src, 'asset', 'card'
        )

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
        file_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore, file_semaphore)

        self.cards_json, self.cardEpisodes_json, ori_eventCards_json = (
            await asyncio.gather(
                self.fetch_url_json(
                    self.cards_url, force_online=self.force_master_online
                ),
                self.fetch_url_json(
                    self.cardEpisodes_url, force_online=self.force_master_online
                ),
                self.fetch_url_json(
                    self.eventCards_url, force_online=self.force_master_online
                ),
            )
        )

        self.eventCards_json: list[dict[str, Any]] = []
        for item in ori_eventCards_json:
            if item['isDisplayCardStory']:
                self.eventCards_json.append(item)

        self.cards_lookup = util.DictLookup(self.cards_json, 'id')
        self.cardEpisodes_lookup = util.DictLookup(self.cardEpisodes_json, 'cardId')
        self.eventCards_lookup = util.DictLookup(self.eventCards_json, 'cardId')

    async def get(self, card_id: int) -> None:
        card_index = self.cards_lookup.find_index(card_id)
        cardEpisode_index = self.cardEpisodes_lookup.find_index(card_id)

        if (card_index == -1) or (cardEpisode_index == -1):
            logging.info(f'card {card_id} does not exist.')
            return

        card = self.cards_json[card_index]
        cardEpisode_1 = self.cardEpisodes_json[cardEpisode_index]
        cardEpisode_2 = self.cardEpisodes_json[cardEpisode_index + 1]

        chara_unit_and_name = '_'.join(
            self.reader.get_chara_unitAbbr_names(card['characterId'])[:2]
        )
        chara_name = self.reader.get_chara_unitAbbr_names(card['characterId'])[1]
        cardRarityType = Constant.rarity_name[card['cardRarityType']]
        card_name = card['prefix']
        card_gachaPhrase = card['gachaPhrase'].replace('\n', ' ')
        sub_unit = card['supportUnit']
        assetbundleName: str = card['assetbundleName']

        story_1_name = cardEpisode_1['title']
        story_2_name = cardEpisode_2['title']
        story_1_scenarioId = cardEpisode_1['scenarioId']
        story_2_scenarioId = cardEpisode_2['scenarioId']

        card_save_dir = os.path.join(
            self.save_dir,
            util.valid_filename(self.reader.lang + '-' + chara_unit_and_name),
        )

        if self.parse:
            os.makedirs(card_save_dir, exist_ok=True)

        if sub_unit != 'none':
            sub_unit_name = f' ({Constant.unit_code_abbr[sub_unit]})'
        else:
            sub_unit_name = ''

        card_event_index = self.eventCards_lookup.find_index(card_id)
        if card_event_index == -1:
            belong_event = ''
        else:
            belong_event = (
                f" (event_{self.eventCards_json[card_event_index]['eventId']})"
            )

        card_story_name = f'{card_id}_{chara_name}{sub_unit_name}_{cardRarityType} {card_name}{belong_event}'

        card_story_filename = util.valid_filename(
            f'{card_id:0{self.maxlen_id}}_{chara_name}{sub_unit_name}_{cardRarityType} {card_name}{belong_event}'
        )

        story_1_json, story_2_json = await asyncio.gather(
            self.fetch_url_json(
                [
                    url.format(
                        assetbundleName=assetbundleName, scenarioId=story_1_scenarioId
                    )
                    for url in self.card_asset_url
                ],
                card_story_name + ' part1',
                compress=self.compress_assets,
                skip_read=not self.parse,
            ),
            self.fetch_url_json(
                [
                    url.format(
                        assetbundleName=assetbundleName, scenarioId=story_2_scenarioId
                    )
                    for url in self.card_asset_url
                ],
                card_story_name + ' part2',
                compress=self.compress_assets,
                skip_read=not self.parse,
            ),
        )

        if self.parse and not util.judge_need_skip(story_1_json, story_2_json):
            text_1 = self.reader.read_story_in_json(story_1_json)
            text_2 = self.reader.read_story_in_json(story_2_json)

            async with self.file_semaphore:
                async with aiofiles.open(
                    os.path.join(card_save_dir, card_story_filename) + '.txt',
                    'w',
                    encoding='utf8',
                ) as f:
                    await f.write(card_story_name + '\n\n')
                    if card_gachaPhrase != '-':
                        await f.write(
                            Mark_multi_lang['gacha phrase'][self.reader.mark_lang]
                            + card_gachaPhrase
                            + '\n\n'
                        )
                    await f.write(
                        Mark_multi_lang['<'][self.reader.mark_lang]
                        + story_1_name
                        + Mark_multi_lang['>'][self.reader.mark_lang]
                        + '\n\n'
                    )
                    await f.write(text_1 + '\n\n\n')
                    await f.write(
                        Mark_multi_lang['<'][self.reader.mark_lang]
                        + story_2_name
                        + Mark_multi_lang['>'][self.reader.mark_lang]
                        + '\n\n'
                    )
                    await f.write(text_2 + '\n')

        logging.info(f'get card {card_story_name} done.')

    async def get_event(self, event_id: int) -> None:
        newest_event_id = self.eventCards_json[-1]['eventId']
        if event_id > newest_event_id + 1:
            return

        if event_id == 0:
            start_cardid = 1
            end_cardid = self.eventCards_json[0]['cardId'] - 1
        elif event_id == 1:
            event_cardids = [
                card['cardId']
                for card in self.eventCards_json
                if card['eventId'] == event_id
            ]
            start_cardid = event_cardids[0]
            end_cardid = event_cardids[-1]
        elif event_id == newest_event_id + 1:
            start_cardid = self.eventCards_json[-1]['cardId'] + 1
            end_cardid = self.cardEpisodes_json[-1]['cardId']
        else:
            last_event_cardids: list[int] = []
            forward_i = 1
            while len(last_event_cardids) == 0 and (event_id - forward_i > 0):
                last_event_cardids = [
                    card['cardId']
                    for card in self.eventCards_json
                    if card['eventId'] == event_id - forward_i
                ]
                forward_i += 1
            start_cardid = last_event_cardids[-1] + 1

            event_cardids = [
                card['cardId']
                for card in self.eventCards_json
                if card['eventId'] == event_id
            ]

            if len(event_cardids) > 0:
                end_cardid = event_cardids[-1]
            else:
                return

        tasks = []
        for i in range(start_cardid, end_cardid + 1):
            tasks.append(self.get(i))
        await asyncio.gather(*tasks)

    async def get_newest(
        self,
        quantity: int = 50,
        timestamp13: int | None = None,
    ) -> None:
        '''
        quantity 0 = all
        '''
        if timestamp13 is None:
            timestamp13 = int(time.time() * 1000)

        old_cards: list[tuple[int, int]] = []

        for card in self.cards_json:
            if card['releaseAt'] <= timestamp13:
                old_cards.append((card['releaseAt'], card['id']))

        new_cards = sorted(old_cards)[-quantity:]
        new_cardids = [x[1] for x in new_cards]

        tasks = []
        for i in new_cardids:
            tasks.append(self.get(i))
        await asyncio.gather(*tasks)


class Area_talk_getter(Pjsk_getter):
    def __init__(
        self,
        reader: Story_reader,
        src: list[str] = ['haruki', 'sekai.best'],
        save_dir: str = './story_area',
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        parse: bool = True,
        missing_download: bool = True,
        maxlen_eventId_areaID: tuple[int, int] = (3, 2),
        print_fetch_detial: bool = False,
        compress_assets: bool = False,
        force_master_online: bool = False,
    ) -> None:

        super().__init__(
            save_dir,
            assets_save_dir,
            online,
            save_assets,
            parse,
            missing_download,
            compress_assets,
            force_master_online,
        )

        self.reader = reader
        self.maxlen_eventId_areaID = maxlen_eventId_areaID
        self.print_fetch_detial = print_fetch_detial

        self.areas_url = Constant.get_srcs_url(self.reader.lang, src, 'master', 'areas')
        self.actionSets_url = Constant.get_srcs_url(
            self.reader.lang, src, 'master', 'actionSets'
        )
        self.talk_asset_url = Constant.get_srcs_url(
            self.reader.lang, src, 'asset', 'talk'
        )

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
        file_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore, file_semaphore)

        self.area_name_json, self.actionSets_json = await asyncio.gather(
            self.fetch_url_json(self.areas_url, force_online=self.force_master_online),
            self.fetch_url_json(
                self.actionSets_url, force_online=self.force_master_online
            ),
        )

        self.area_name_lookup = util.DictLookup(self.area_name_json, 'id')
        self.actionSets_json_lookup = util.DictLookup(self.actionSets_json, 'id')

    def __get_category(self, action: dict[str, Any]) -> int | str:
        '''
        category: int: event_id; str: grade1, grade2, theater, limited_{area_id}, aprilfool2022+
        '''
        if (
            ('scenarioId' in action)
            and (len(cond := str(action['releaseConditionId'])) == 6)
            and (cond[0] == '1')
        ):
            return int(cond[1:4]) + 1
        elif action['id'] == 2373:  # special case for mzk5
            return 145
        elif (
            ('scenarioId' in action)
            and (action.get("actionSetType") == "limited")
            and ('aprilfool' not in action['scenarioId'])
        ):
            return f"limited_{action['areaId']}"
        elif ('scenarioId' in action) and ('aprilfool' in action['scenarioId']):
            talk_name: str = action['scenarioId']
            return talk_name.split('_')[1]
        elif (
            ('scenarioId' in action)
            and (action.get("actionSetType") == "normal")
            and (action["isNextGrade"] == False)
            and (action["releaseConditionId"] == 1)
        ):
            return 'grade1'
        elif (
            ('scenarioId' in action)
            and (action.get("actionSetType") == "normal")
            and (action["isNextGrade"] == True)
            and (action["releaseConditionId"] == 1)
        ):
            return 'grade2'
        elif ('scenarioId' in action) and (
            2000000 <= action["releaseConditionId"] <= 2000036
        ):  # cn and jp have diff
            return 'theater'
        else:
            assert 'scenarioId' not in action or action['scenarioId'] == 'op_02area'
            return ''

    async def get(self, target: int | str) -> None:
        '''
        target: int: event_id; str: grade1, grade2, theater, limited_{area_id}, aprilfool2022+
        '''

        actions = [
            action
            for action in self.actionSets_json
            if self.__get_category(action) == target
        ]

        if len(actions) == 0:
            logging.info(f'talk {target} does not exist.')
            return

        if self.parse:
            os.makedirs(self.save_dir, exist_ok=True)

        tasks = []
        for action in actions:
            tasks.append(
                self.fetch_url_json(
                    [
                        url.format(
                            group=math.floor(action['id'] / 100),
                            scenarioId=action['scenarioId'],
                        )
                        for url in self.talk_asset_url
                    ],
                    print_done=self.print_fetch_detial,
                    compress=self.compress_assets,
                    skip_read=not self.parse,
                )
            )

        talk_jsons = await asyncio.gather(*tasks)

        if self.parse and not util.judge_need_skip(talk_jsons):
            texts = [
                self.reader.read_story_in_json(talk_json) for talk_json in talk_jsons
            ]

            if isinstance(target, int):  # event id
                filename = f'talk_event_{target:0{self.maxlen_eventId_areaID[0]}}'
            elif target.startswith('limited_'):
                filename = f'talk_{target.split('_')[0]}_{target.split('_')[1]:0{self.maxlen_eventId_areaID[1]}}'
            else:
                filename = f'talk_{target}'

            filename = util.valid_filename(self.reader.lang + '-' + filename)

            async with self.file_semaphore:
                async with aiofiles.open(
                    os.path.join(self.save_dir, filename) + '.txt',
                    'w',
                    encoding='utf8',
                ) as f:
                    for index, (action, text) in enumerate(zip(actions, texts)):
                        area_name_index = self.area_name_lookup.find_index(
                            action['areaId']
                        )
                        area_name = self.area_name_json[area_name_index]['name']
                        sub_name = self.area_name_json[area_name_index].get('subName')
                        if sub_name is not None:
                            area_name += ' - ' + sub_name

                        talk_type = ''
                        if isinstance(target, int):
                            if '_ev_' in action['scenarioId']:
                                talk_type = ' event'
                            elif '_wl_' in action['scenarioId']:
                                talk_type = ' wl'
                            elif '_monthly' in action['scenarioId']:
                                talk_type = ' monthly'
                            elif '_add_' in action['scenarioId']:
                                talk_type = ' add'
                            else:
                                assert action['id'] == 618  # special case

                        left = Mark_multi_lang['['][self.reader.mark_lang]
                        right = Mark_multi_lang[']'][self.reader.mark_lang]
                        await f.write(
                            f"{index+1} {action['id']}{talk_type} {left}{area_name}{right}\n\n"
                        )
                        await f.write(text + '\n\n\n')

        logging.info(f'get talk {target} done.')

    # mainly for update new talk
    async def get_id_range(
        self, start: int | None = None, end: int | None = None
    ) -> None:
        if start is None:
            start = 1
        if end is None:
            end = cast(int, self.actionSets_json[-1]['id'] + 1)
        categories = set()
        for i in range(start, end):
            actionSets_index = self.actionSets_json_lookup.find_index(i)
            cate = self.__get_category(self.actionSets_json[actionSets_index])
            if cate != '':
                categories.add(cate)
        tasks = []
        for cate in categories:
            tasks.append(self.get(cate))
        await asyncio.gather(*tasks)

    # for debug
    async def get_id_to_single_file(self, talk_id: int) -> None:
        actionSets_index = self.actionSets_json_lookup.find_index(talk_id)
        if actionSets_index == -1:
            logging.info(f'talk {talk_id} does not exist.')
            return

        actionSet = self.actionSets_json[actionSets_index]

        cate = self.__get_category(actionSet)

        if 'scenarioId' not in actionSet:
            logging.info(f'talk {talk_id} does have content.')
            return

        if self.parse:
            os.makedirs(self.save_dir, exist_ok=True)

        talk_json = await self.fetch_url_json(
            [
                url.format(
                    group=math.floor(talk_id / 100), scenarioId=actionSet['scenarioId']
                )
                for url in self.talk_asset_url
            ],
            compress=self.compress_assets,
            skip_read=not self.parse,
        )

        if self.parse and not util.judge_need_skip(talk_json):
            text = self.reader.read_story_in_json(talk_json)

            filename = f'talk_{talk_id}'
            filename = self.reader.lang + '-' + filename

            area_name_index = self.area_name_lookup.find_index(actionSet['areaId'])
            area_name = self.area_name_json[area_name_index]['name']
            sub_name = self.area_name_json[area_name_index].get('subName')
            if sub_name is not None:
                area_name += ' - ' + sub_name

            async with self.file_semaphore:
                async with aiofiles.open(
                    os.path.join(self.save_dir, filename) + '.txt',
                    'w',
                    encoding='utf8',
                ) as f:
                    left = Mark_multi_lang['['][self.reader.mark_lang]
                    right = Mark_multi_lang[']'][self.reader.mark_lang]
                    await f.write(
                        f"{actionSet['id']} {cate} {left}{area_name}{right}\n\n"
                    )
                    await f.write(text + '\n')

        logging.info(f'get talk {talk_id} done.')

    def tell_categories(self) -> set[str | int]:
        ret = set()
        for actionSet in self.actionSets_json:
            cate = self.__get_category(actionSet)
            if cate != '':
                ret.add(cate)
        return ret


class Self_intro_getter(Pjsk_getter):
    def __init__(
        self,
        reader: Story_reader,
        src: list[str] = ['haruki', 'sekai.best'],
        save_dir: str = './story_self',
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        parse: bool = True,
        missing_download: bool = True,
        compress_assets: bool = False,
        force_master_online: bool = False,
    ):
        super().__init__(
            save_dir,
            assets_save_dir,
            online,
            save_assets,
            parse,
            missing_download,
            compress_assets,
            force_master_online,
        )

        self.reader = reader

        self.characterProfiles_url = Constant.get_srcs_url(
            self.reader.lang, src, 'master', 'characterProfiles'
        )
        self.self_asset_url = Constant.get_srcs_url(
            self.reader.lang, src, 'asset', 'self'
        )

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
        file_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore, file_semaphore)

        self.characterProfiles_json: list[dict[str, Any]] = await self.fetch_url_json(
            self.characterProfiles_url, force_online=self.force_master_online
        )

        self.characterProfiles_lookup = util.DictLookup(
            self.characterProfiles_json, 'characterId'
        )

    async def get(self, chara_id: int) -> None:
        profile_index = self.characterProfiles_lookup.find_index(chara_id)
        if profile_index == -1:
            logging.info(f'character {chara_id} does not exist.')
            return

        chara_unit_name = '_'.join(self.reader.get_chara_unitAbbr_names(chara_id)[:2])

        filename = util.valid_filename(self.reader.lang + '-' + chara_unit_name)

        profile = self.characterProfiles_json[profile_index]
        scenarioId: str = profile['scenarioId']

        scenarioId_common = scenarioId[: scenarioId.rindex('_')]

        grade1_json, grade2_json = await asyncio.gather(
            self.fetch_url_json(
                [
                    url.format(scenarioId=scenarioId_common)
                    for url in self.self_asset_url
                ],
                compress=self.compress_assets,
                skip_read=not self.parse,
            ),
            self.fetch_url_json(
                [url.format(scenarioId=scenarioId) for url in self.self_asset_url],
                compress=self.compress_assets,
                skip_read=not self.parse,
            ),
        )

        if self.parse and not util.judge_need_skip(grade1_json, grade2_json):
            os.makedirs(self.save_dir, exist_ok=True)

            text_1 = self.reader.read_story_in_json(grade1_json)
            text_2 = self.reader.read_story_in_json(grade2_json)

            async with self.file_semaphore:
                async with aiofiles.open(
                    os.path.join(self.save_dir, filename) + '.txt',
                    'w',
                    encoding='utf8',
                ) as f:
                    await f.write(
                        f"{Mark_multi_lang['self intro'][self.reader.mark_lang]}{chara_unit_name.split('_')[1]}\n\n"
                    )
                    await f.write(
                        Mark_multi_lang['<'][self.reader.mark_lang]
                        + 'YEAR 1'
                        + Mark_multi_lang['>'][self.reader.mark_lang]
                        + '\n\n'
                    )
                    await f.write(text_1 + '\n\n\n')
                    await f.write(
                        Mark_multi_lang['<'][self.reader.mark_lang]
                        + 'YEAR 2'
                        + Mark_multi_lang['>'][self.reader.mark_lang]
                        + '\n\n'
                    )
                    await f.write(text_2 + '\n')

        logging.info(f'get self intro {filename} done.')

    def tell_ids(self) -> list[int]:
        ret = []
        for chara in self.characterProfiles_json:
            ret.append(chara['characterId'])
        return ret


class Special_story_getter(Pjsk_getter):
    def __init__(
        self,
        reader: Story_reader,
        src: list[str] = ['haruki', 'sekai.best'],
        save_dir: str = './story_special',
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        parse: bool = True,
        missing_download: bool = True,
        maxlen_sp: int = 3,
        compress_assets: bool = False,
        force_master_online: bool = False,
    ):
        super().__init__(
            save_dir,
            assets_save_dir,
            online,
            save_assets,
            parse,
            missing_download,
            compress_assets,
            force_master_online,
        )

        self.reader = reader
        self.maxlen_sp = maxlen_sp

        self.specialStories_url = Constant.get_srcs_url(
            self.reader.lang, src, 'master', 'specialStories'
        )
        self.special_asset_url = Constant.get_srcs_url(
            self.reader.lang, src, 'asset', 'special'
        )

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
        file_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore, file_semaphore)

        self.specialStories_json: list[dict[str, Any]] = await self.fetch_url_json(
            self.specialStories_url, force_online=self.force_master_online
        )

        self.specialStories_lookup = util.DictLookup(self.specialStories_json, 'id')

    async def get(self, id: int) -> None:
        story_index = self.specialStories_lookup.find_index(id)
        if story_index == -1 or id == 2:  # special case id2
            logging.info(f'special story {id} does not exist.')
            return

        story = self.specialStories_json[story_index]
        episodes = story['episodes']
        title = story.get('title')

        if title is None:
            title = episodes[0]['title']

        story_name = f'sp{id}_{title}'

        filename = util.valid_filename(
            self.reader.lang + '-' f'sp{id:0{self.maxlen_sp}}_{title}'
        )

        episode_tasks = []
        for episode in episodes:
            episode_tasks.append(
                self.fetch_url_json(
                    [
                        url.format(
                            assetbundleName=episode['assetbundleName'],
                            scenarioId=episode['scenarioId'],
                        )
                        for url in self.special_asset_url
                    ],
                    filename,
                    compress=self.compress_assets,
                    skip_read=not self.parse,
                )
            )
        episode_story_jsons = await asyncio.gather(*episode_tasks)

        if self.parse and not util.judge_need_skip(episode_story_jsons):
            os.makedirs(self.save_dir, exist_ok=True)

            texts = [
                self.reader.read_story_in_json(episode_story_json)
                for episode_story_json in episode_story_jsons
            ]

            if len(episodes) > 1:
                record_No = True
            else:
                record_No = False

            async with self.file_semaphore:
                async with aiofiles.open(
                    os.path.join(self.save_dir, filename) + '.txt',
                    'w',
                    encoding='utf8',
                ) as f:
                    await f.write(story_name + '\n\n')
                    for episode, text in zip(episodes, texts):
                        if record_No:
                            await f.write(str(episode['episodeNo']) + ' ')
                        await f.write(
                            Mark_multi_lang['<'][self.reader.mark_lang]
                            + episode['title']
                            + Mark_multi_lang['>'][self.reader.mark_lang]
                            + '\n\n'
                        )
                        await f.write(text + '\n\n\n')

        logging.info(f'get special {filename} done.')

    def tell_ids(self):
        ret = []
        for sp in self.specialStories_json:
            ret.append(sp['id'])
        return ret


async def main():

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(message)s", datefmt="%H:%M:%S"
    )

    net_connect_limit = 20

    online = False

    text_lang = 'cn'
    mark_lang = 'cn'

    reader = Story_reader(text_lang, online=online, mark_lang=mark_lang)
    unit_getter = Unit_story_getter(reader, online=online)
    event_getter = Event_story_getter(reader, online=online)
    card_getter = Card_story_getter(reader, online=online)
    area_getter = Area_talk_getter(reader, online=online)
    self_getter = Self_intro_getter(reader, online=online)
    special_getter = Special_story_getter(reader, online=online)

    async with ClientSession(
        trust_env=True, connector=TCPConnector(limit=net_connect_limit)
    ) as session:
        await asyncio.gather(
            reader.init(session),
            unit_getter.init(session),
            event_getter.init(session),
            card_getter.init(session),
            area_getter.init(session),
            self_getter.init(session),
            special_getter.init(session),
        )

        tasks = []

        for i in range(1, 3):
            tasks.append(unit_getter.get(i))
        for i in range(1, 4):
            tasks.append(event_getter.get(i))
        for i in range(1, 4):
            tasks.append(card_getter.get(i))
        for i in range(1, 4):
            tasks.append(area_getter.get(i))
        for i in range(1, 3):
            tasks.append(self_getter.get(i))
        for i in range(1, 5):
            tasks.append(special_getter.get(i))

        await asyncio.gather(*tasks)


if __name__ == '__main__':
    asyncio.run(main())
