import os, asyncio, json, time, logging, copy
from pathlib import Path
from typing import Any
from asyncio import Semaphore

from aiohttp import ClientSession, TCPConnector

from . import util
from .util import Mark_multi_lang

URLS: dict[str, dict[str, str]] = json.load(
    open(Path(__file__).parent / 'urls_bang.json', encoding='utf8')
)


class Constant:
    lang_index = {'jp': 0, 'en': 1, 'tw': 2, 'cn': 3, 'kr': 4}

    band_id_abbr = {
        1: 'PPP',
        2: 'Ag',
        3: 'HHW',
        4: 'PP',
        5: 'Ro',
        18: 'RAS',
        21: 'Mor',
        45: 'MyGO',
    }


class Story_reader(util.Base_fetcher):
    def __init__(
        self,
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        missing_download: bool = True,
        debug_parse: bool = False,
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

        self.debug_parse = debug_parse

        self.characters_main_url = URLS['bestdori.com']['characters_main_3']

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore)

        self.characters_json = await self.fetch_url_json(
            self.characters_main_url, force_online=self.force_master_online
        )

    def get_chara_bandAbbr_and_names(
        self, chara_id: int, lang: str
    ) -> tuple[str, str, str]:
        if str(chara_id) not in self.characters_json:
            return '', '', ''
        fullname: str = self.characters_json[str(chara_id)]['characterName'][
            Constant.lang_index[lang]
        ]
        if lang in ('jp', 'cn', 'tw'):
            fullname = fullname.replace(' ', '')
        shortname = self.characters_json[str(chara_id)]['firstName'][
            Constant.lang_index[lang]
        ]
        band_id = self.characters_json[str(chara_id)]['bandId']
        band_abbr = Constant.band_id_abbr[band_id]
        return band_abbr, fullname, shortname

    def read_story_in_json(
        self,
        json_data: str | dict[str, dict[str, Any]],
        lang: str,
        mark_lang: str,
    ) -> str:
        if isinstance(json_data, str):
            return json_data

        talks = json_data['Base']['talkData']
        specialEffects = json_data['Base']['specialEffectData']

        appearCharacters = json_data['Base']['appearCharacters']
        chara_id = set()
        for chara in appearCharacters:
            if str(chara['characterId']) in self.characters_json:
                chara_id.add(chara['characterId'])
        chara_id_list = sorted(chara_id)

        if len(chara_id_list) > 0:
            ret0 = (
                Mark_multi_lang['characters'][mark_lang]
                + Mark_multi_lang[','][mark_lang].join(
                    [
                        self.get_chara_bandAbbr_and_names(id, lang)[1]
                        for id in chara_id_list
                    ]
                )
                + Mark_multi_lang[')'][mark_lang]
            )
        else:
            ret0 = ''

        snippets = json_data['Base']['snippets']
        next_talk_need_newline = True

        ret = ''
        index = -1
        for snippet in snippets:
            index += 1
            if self.debug_parse:
                ret += f"{index},{snippet['referenceIndex']},"

            if snippet['actionType'] == util.SnippetAction.SpecialEffect:
                specialEffect = specialEffects[snippet['referenceIndex']]
                if specialEffect['effectType'] == util.SpecialEffectType.Telop:
                    ret += (
                        '\n'
                        + Mark_multi_lang['['][mark_lang]
                        + specialEffect['stringVal']
                        + Mark_multi_lang[']'][mark_lang]
                        + '\n'
                    )
                    next_talk_need_newline = True
                elif (
                    specialEffect['effectType']
                    == util.SpecialEffectType.ChangeBackground
                ):
                    if next_talk_need_newline:
                        ret += '\n'
                    ret += (
                        Mark_multi_lang['background'][mark_lang]
                        + (f": {specialEffect}" if self.debug_parse else '')
                        + '\n'
                    )
                    next_talk_need_newline = False
                elif specialEffect['effectType'] == util.SpecialEffectType.FlashbackIn:
                    ret += '\n' + Mark_multi_lang['memory in'][mark_lang] + '\n'
                    next_talk_need_newline = True
                elif specialEffect['effectType'] == util.SpecialEffectType.FlashbackOut:
                    ret += '\n' + Mark_multi_lang['memory out'][mark_lang] + '\n'
                    next_talk_need_newline = True
                elif specialEffect['effectType'] == util.SpecialEffectType.BlackOut:
                    if next_talk_need_newline:
                        ret += '\n'
                    ret += Mark_multi_lang['black out'][mark_lang] + '\n'
                    next_talk_need_newline = False
                elif specialEffect['effectType'] == util.SpecialEffectType.WhiteOut:
                    if next_talk_need_newline:
                        ret += '\n'
                    ret += Mark_multi_lang['white out'][mark_lang] + '\n'
                    next_talk_need_newline = False
                else:
                    if self.debug_parse:
                        try:
                            effect_name = util.SpecialEffectType(
                                specialEffect['effectType']
                            ).name
                        except ValueError:
                            effect_name = specialEffect['effectType']
                        ret += f"SpecialEffect-{effect_name}: {specialEffect}\n"
            elif snippet['actionType'] == util.SnippetAction.Talk:
                talk = talks[snippet['referenceIndex']]

                talk_charaid = talk['talkCharacters'][0]['characterId']
                _, speaker_fullname, speaker_shortname = (
                    self.get_chara_bandAbbr_and_names(talk_charaid, lang)
                )

                displayname = talk['windowDisplayName'].replace('\n', ' ')

                if len(speaker_fullname) > 0 and displayname not in (
                    speaker_fullname,
                    speaker_shortname,
                ):
                    name = (
                        displayname
                        + util.Mark_multi_lang['('][mark_lang]
                        + speaker_shortname
                        + util.Mark_multi_lang[')'][mark_lang]
                    )
                else:
                    name = displayname

                if next_talk_need_newline:
                    ret += '\n'
                ret += (
                    name
                    + Mark_multi_lang[':'][mark_lang]
                    + talk['body'].replace('\n', ' ')
                    + '\n'
                )
                next_talk_need_newline = False
            else:
                if self.debug_parse:
                    try:
                        snippet_name = util.SnippetAction(snippet['actionType']).name
                    except ValueError:
                        snippet_name = snippet['actionType']
                    ret += f"{snippet_name}\n"

        return (ret0 + '\n\n' + ret.strip()).strip()


class Event_story_getter(util.Base_getter):

    event_is_main = [217]

    def __init__(
        self,
        reader: Story_reader,
        save_dir: str = './story_{lang}/event',
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        parse: bool = True,
        missing_download: bool = True,
        maxlen_eventId: int = 3,
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
        self.maxlen_eventId = maxlen_eventId

        self.events_all_url = URLS['bestdori.com']['events_all_3']
        self.events_id_url = URLS['bestdori.com']['events_id']
        self.event_asset_url = URLS['bestdori.com']['event_asset']

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore)

        self.events_all_json: dict[str, dict[str, Any]] = await self.fetch_url_json(
            self.events_all_url, force_online=self.force_master_online
        )

        self.events_ids: set[int] = {int(id) for id in self.events_all_json.keys()}

    async def get(self, event_id: int, lang: str = 'cn', mark_lang: str = 'cn') -> None:
        if event_id not in self.events_ids or event_id == 5001:  # special case for tw
            logging.info(f'event {event_id} does not exist.')
            return

        info_json: dict[str, Any] = await self.fetch_url_json(
            self.events_id_url.format(event_id=event_id),
            force_online=self.force_master_online,
        )

        event_name = info_json['eventName'][Constant.lang_index[lang]]
        if event_name is None:
            logging.info(f'event {event_id} has no {lang.upper()}.')
            return
        if len(info_json['stories']) == 0:
            logging.info(f'event {event_id} has no story.')
            return

        event_filename = util.valid_filename(event_name)

        save_folder_name = f'{event_id:0{self.maxlen_eventId}} {event_filename}'

        event_save_dir = os.path.join(self.save_dir.format(lang=lang), save_folder_name)

        if self.parse:
            os.makedirs(Path(event_save_dir).parent, exist_ok=True)
            util.remove_olds_or_rename_old(event_save_dir, r'(\d+) ')
            os.makedirs(event_save_dir, exist_ok=True)

        tasks = []
        for story in info_json['stories']:
            tasks.append(
                self.__get_story(
                    story, lang, event_id, event_save_dir, event_name, mark_lang
                )
            )
        await asyncio.gather(*tasks)

    async def __get_story(
        self,
        story: dict[str, Any],
        lang: str,
        event_id: int,
        event_save_dir: str,
        event_name: str,
        mark_lang: str,
    ):
        name = f"{story['scenarioId']} {story['caption'][Constant.lang_index[lang]]} {story['title'][Constant.lang_index[lang]]}"

        synopsis: str | None = story['synopsis'][Constant.lang_index[lang]]
        if synopsis is not None:  # for 13 20 23, jp meta lost
            synopsis = synopsis.replace('\n', ' ')

        id = story['scenarioId']

        filename = util.valid_filename(name)

        if ('bandStoryId' not in story) and (
            event_id not in Event_story_getter.event_is_main
        ):
            story_json = await self.fetch_url_json(
                self.event_asset_url.format(lang=lang, event_id=event_id, id=id),
                filename,
                compress=self.compress_assets,
                skip_read=not self.parse,
            )

            if self.parse:
                text = self.reader.read_story_in_json(story_json, lang, mark_lang)
            else:
                text = ''
        elif event_id in Event_story_getter.event_is_main:
            text = Mark_multi_lang['see main story'][mark_lang]
            story_json = ''
        else:
            text = Mark_multi_lang['see band story'][mark_lang]
            story_json = ''

        if self.parse and not util.judge_need_skip(story_json):
            file_path = os.path.join(event_save_dir, filename) + '.txt'
            util.remove_olds_or_rename_old(file_path, r'([^\s]+) ')
            with open(file_path, 'w', encoding='utf8') as f:
                f.write(name + '\n\n')
                f.write(f'{synopsis}' + '\n\n')
                f.write(text + '\n')

        logging.info(f'get event {event_id} {event_name} {name} done.')

    async def get_newest(
        self,
        lang: str = 'cn',
        mark_lang: str = 'cn',
        quantity: int = 10,
        timestamp13: int | None = None,
    ) -> None:
        '''
        quantity 0 = all
        '''
        if timestamp13 is None:
            timestamp13 = int(time.time() * 1000)

        old_events: list[tuple[int, int]] = []

        for str_id, event in self.events_all_json.items():
            if (
                (startAt := event['startAt'][Constant.lang_index[lang]]) is not None
            ) and int(startAt) <= timestamp13:
                old_events.append((int(startAt), int(str_id)))

        new_events = sorted(old_events)[-quantity:]
        new_eventids = [x[1] for x in new_events]

        tasks = []
        for i in new_eventids:
            tasks.append(self.get(i, lang, mark_lang))
        await asyncio.gather(*tasks)


class Band_story_getter(util.Base_getter):
    def __init__(
        self,
        reader: Story_reader,
        save_dir: str = './story_{lang}/band',
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        parse: bool = True,
        missing_download: bool = True,
        maxlen_bandId: int = 2,
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
        self.maxlen_bandId = maxlen_bandId

        self.bands_main_url = URLS['bestdori.com']['bands_main_1']
        self.bandstories_5_url = URLS['bestdori.com']['bandstories_5']
        self.band_asset_url = URLS['bestdori.com']['band_asset']

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore)

        self.bands_json, self.info_json = await asyncio.gather(
            self.fetch_url_json(
                self.bands_main_url, force_online=self.force_master_online
            ),
            self.fetch_url_json(
                self.bandstories_5_url, force_online=self.force_master_online
            ),
        )

    async def get(
        self,
        want_band_id: int | None = None,
        want_chapter_number: int | None = None,
        lang: str = 'cn',
        mark_lang: str = 'cn',
    ) -> None:

        tasks = []
        for band_story in self.info_json.values():
            band_id: int = band_story['bandId']
            try:
                chapterNumber = band_story['chapterNumber']
            except KeyError:
                continue

            if want_band_id is not None:
                if want_band_id != band_id:
                    continue
            if want_chapter_number is not None:
                if want_chapter_number != chapterNumber:
                    continue

            band_name = self.bands_json[str(band_id)]['bandName'][
                Constant.lang_index[lang]
            ]

            if band_story['mainTitle'][Constant.lang_index[lang]] == None:
                logging.info(
                    f'band story {band_name} {band_story["mainTitle"][0]} {band_story["subTitle"][0]} has no {lang.upper()}.'
                )
                continue

            save_folder_name = util.valid_filename(
                f'{band_story["mainTitle"][Constant.lang_index[lang]]} {band_story["subTitle"][Constant.lang_index[lang]]}'
            )

            band_save_dir = os.path.join(
                self.save_dir.format(lang=lang),
                f'{band_id:0{self.maxlen_bandId}} {band_name}',
                save_folder_name,
            )
            if self.parse:
                os.makedirs(Path(band_save_dir).parents[1], exist_ok=True)
                util.remove_olds_or_rename_old(Path(band_save_dir).parent, r'(\d+) ')

                os.makedirs(Path(band_save_dir).parent, exist_ok=True)
                util.remove_olds_or_rename_old(band_save_dir, r'([^\s]+) ')
                os.makedirs(band_save_dir, exist_ok=True)

            for story in band_story['stories'].values():
                tasks.append(
                    self.__get_story(
                        story,
                        lang,
                        band_id,
                        band_save_dir,
                        band_name,
                        band_story,
                        mark_lang,
                    )
                )
        await asyncio.gather(*tasks)

    async def __get_story(
        self,
        story: dict[str, Any],
        lang: str,
        band_id: int,
        band_save_dir: str,
        band_name: str,
        band_story: dict[str, Any],
        mark_lang: str,
    ):
        name = f"{story['scenarioId']} {story['caption'][Constant.lang_index[lang]]} {story['title'][Constant.lang_index[lang]]}"
        synopsis = story['synopsis'][Constant.lang_index[lang]].replace('\n', ' ')
        id = story['scenarioId']

        filename = util.valid_filename(name)

        story_json: dict[str, dict[str, Any]] = await self.fetch_url_json(
            self.band_asset_url.format(lang=lang, band_id=band_id, id=id),
            filename,
            compress=self.compress_assets,
            skip_read=not self.parse,
        )

        if self.parse and not util.judge_need_skip(story_json):
            text = self.reader.read_story_in_json(story_json, lang, mark_lang)

            file_path = os.path.join(band_save_dir, filename) + '.txt'
            util.remove_olds_or_rename_old(file_path, r'([^\s]+) ')
            with open(file_path, 'w', encoding='utf8') as f:
                f.write(name + '\n\n')
                f.write(synopsis + '\n\n')
                f.write(text + '\n')

        logging.info(
            f'get band story {band_name} {band_story["mainTitle"][Constant.lang_index[lang]]} {name} done.'
        )


class Main_story_getter(util.Base_getter):
    def __init__(
        self,
        reader: Story_reader,
        save_dir: str = './story_{lang}/main',
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

        self.mainstories_5_url = URLS['bestdori.com']['mainstories_5']
        self.main_asset_url = URLS['bestdori.com']['main_asset']

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore)

        self.info_json: dict[str, dict[str, Any]] = await self.fetch_url_json(
            self.mainstories_5_url, force_online=self.force_master_online
        )

    async def get(
        self, id_range: list[int] | None = None, lang: str = 'cn', mark_lang: str = 'cn'
    ) -> None:
        if self.parse:
            os.makedirs(self.save_dir.format(lang=lang), exist_ok=True)

        tasks = []
        for strId, main_story in self.info_json.items():
            if id_range is not None and int(strId) not in id_range:
                continue

            if main_story['title'][Constant.lang_index[lang]] == None:
                logging.info(
                    f'main story {main_story["caption"][0]} {main_story["title"][0]} has no {lang.upper()}.'
                )
                continue

            name = f"{main_story['scenarioId']} {main_story['caption'][Constant.lang_index[lang]]} {main_story['title'][Constant.lang_index[lang]]}"

            filename = util.valid_filename(name)

            synopsis = main_story['synopsis'][Constant.lang_index[lang]].replace(
                '\n', ' '
            )
            id = main_story['scenarioId']

            tasks.append(
                self.__get_story(lang, id, filename, name, synopsis, mark_lang)
            )
        await asyncio.gather(*tasks)

    async def __get_story(
        self,
        lang: str,
        id: str,
        filename: str,
        name: str,
        synopsis: str,
        mark_lang: str,
    ) -> None:
        story_json: dict[str, dict[str, Any]] = await self.fetch_url_json(
            self.main_asset_url.format(lang=lang, id=id),
            filename,
            compress=self.compress_assets,
            skip_read=not self.parse,
        )

        if self.parse and not util.judge_need_skip(story_json):
            text = self.reader.read_story_in_json(story_json, lang, mark_lang)

            file_path = os.path.join(self.save_dir.format(lang=lang), filename) + '.txt'
            util.remove_olds_or_rename_old(file_path, r'([^\s]+) ')
            with open(file_path, 'w', encoding='utf8') as f:
                f.write(name + '\n\n')
                f.write(synopsis + '\n\n')
                f.write(text + '\n')

        logging.info(f'get main story {name} done.')


class Card_story_getter(util.Base_getter):
    def __init__(
        self,
        reader: Story_reader,
        save_dir: str = './story_{lang}/card',
        assets_save_dir: str = './assets',
        online: bool = True,
        save_assets: bool = True,
        parse: bool = True,
        missing_download: bool = True,
        maxlen_charaId_cardId: tuple[int, int] = (2, 4),
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
        self.maxlen_charaId_cardId = maxlen_charaId_cardId

        self.cards_all_5_url = URLS['bestdori.com']['cards_all_5']
        self.cards_id_url = URLS['bestdori.com']['cards_id']
        self.card_asset_url = URLS['bestdori.com']['card_asset']

    async def init(
        self,
        session: ClientSession | None = None,
        network_semaphore: Semaphore | None = None,
    ) -> None:
        await super().init(session, network_semaphore)

        self.cards_all_json: dict[str, dict[str, Any]] = await self.fetch_url_json(
            self.cards_all_5_url, force_online=self.force_master_online
        )

        self.cards_ids: set[int] = {int(id) for id in self.cards_all_json.keys()}

    @staticmethod
    def __card_info_cut(content: dict[str, Any]) -> dict[str, Any]:
        if 'source' in content:
            content = copy.deepcopy(content)
            content['source'] = None
        return content

    async def get(self, card_id: int, lang: str = 'cn', mark_lang: str = 'cn') -> None:
        if card_id not in self.cards_ids:
            logging.info(f'card {card_id} does not exist.')
            return

        card = await self.fetch_url_json(
            self.cards_id_url.format(id=card_id),
            force_online=self.force_master_online,
            content_save_edit=Card_story_getter.__card_info_cut,
        )

        if 'episodes' not in card:
            logging.info(f'card {card_id} does not have story.')
            return

        chara_bandAbbr, chara_name, _ = self.reader.get_chara_bandAbbr_and_names(
            card['characterId'], lang
        )
        chara_band_and_name = '_'.join((chara_bandAbbr, chara_name))
        cardRarityType = card['rarity']
        card_name = card['prefix'][Constant.lang_index[lang]]
        card_gachaText: str | None = card['gachaText'][Constant.lang_index[lang]]
        if card_gachaText:
            card_gachaText = card_gachaText.replace('\n', ' ')

        if card_name is None:
            logging.info(f'card {card_id} has no {lang.upper()}.')
            return

        resourceSetName: str = card['resourceSetName']

        card_story_name = f'{card_id}_{chara_name}_R{cardRarityType} {card_name}'

        card_save_dir = os.path.join(
            self.save_dir.format(lang=lang),
            f"{card['characterId']:0{self.maxlen_charaId_cardId[0]}} {chara_band_and_name}",
        )

        card_story_filename = util.valid_filename(
            f'{card_id:0{self.maxlen_charaId_cardId[1]}}_{chara_name}_R{cardRarityType} {card_name}'
        )

        story_1_name = card['episodes']['entries'][0]['title'][
            Constant.lang_index[lang]
        ]
        story_2_name = card['episodes']['entries'][1]['title'][
            Constant.lang_index[lang]
        ]

        story_1_type = card['episodes']['entries'][0]['episodeType']
        story_2_type = card['episodes']['entries'][1]['episodeType']

        if story_1_type != 'animation':
            scenarioId_1 = card['episodes']['entries'][0]['scenarioId']
            story_1_json_task = self.fetch_url_json(
                self.card_asset_url.format(
                    lang=lang, res_id=resourceSetName, scenarioId=scenarioId_1
                ),
                card_story_filename,
                compress=self.compress_assets,
                skip_read=not self.parse,
            )
        else:

            async def noop() -> str:
                return Mark_multi_lang['anime story'][mark_lang]

            story_1_json_task = noop()

        scenarioId_2 = card['episodes']['entries'][1]['scenarioId']

        story_2_json_task = self.fetch_url_json(
            self.card_asset_url.format(
                lang=lang, res_id=resourceSetName, scenarioId=scenarioId_2
            ),
            card_story_filename,
            compress=self.compress_assets,
            skip_read=not self.parse,
        )

        story_1_json, story_2_json = await asyncio.gather(
            story_1_json_task, story_2_json_task
        )

        if self.parse:
            text_1 = self.reader.read_story_in_json(story_1_json, lang, mark_lang)
            text_2 = self.reader.read_story_in_json(story_2_json, lang, mark_lang)
        else:
            text_1 = ''
            text_2 = ''

        if self.parse and not util.judge_need_skip(story_1_json, story_2_json):
            os.makedirs(Path(card_save_dir).parent, exist_ok=True)
            util.remove_olds_or_rename_old(card_save_dir, r'(\d+) ')
            os.makedirs(card_save_dir, exist_ok=True)

            file_path = os.path.join(card_save_dir, card_story_filename) + '.txt'
            util.remove_olds_or_rename_old(file_path, r'(\d+)_')
            with open(file_path, 'w', encoding='utf8') as f:
                f.write(card_story_name + '\n\n')
                if card_gachaText:
                    f.write(
                        Mark_multi_lang['gacha phrase'][mark_lang]
                        + card_gachaText
                        + '\n\n'
                    )
                f.write(
                    Mark_multi_lang['<'][mark_lang]
                    + str(story_1_name)
                    + Mark_multi_lang['>'][mark_lang]
                    + '\n\n'
                )
                f.write(text_1 + '\n\n\n')
                f.write(
                    Mark_multi_lang['<'][mark_lang]
                    + str(story_2_name)
                    + Mark_multi_lang['>'][mark_lang]
                    + '\n\n'
                )
                f.write(text_2 + '\n')

        logging.info(f'get card {card_story_filename} done.')

    async def get_newest(
        self,
        lang: str = 'cn',
        mark_lang: str = 'cn',
        quantity: int = 50,
        timestamp13: int | None = None,
        exclude: list[int] | None = None,
    ) -> None:
        '''
        quantity 0 = all
        '''
        if timestamp13 is None:
            timestamp13 = int(time.time() * 1000)

        old_cards: list[tuple[int, int]] = []

        for str_id, card in self.cards_all_json.items():
            if (
                (releaseAt := card['releasedAt'][Constant.lang_index[lang]]) is not None
            ) and int(releaseAt) <= timestamp13:
                if exclude and int(str_id) in exclude:
                    continue
                old_cards.append((int(releaseAt), int(str_id)))

        new_cards = sorted(old_cards)[-quantity:]
        new_cardids = [x[1] for x in new_cards]

        tasks = []
        for i in new_cardids:
            tasks.append(self.get(i, lang, mark_lang))
        await asyncio.gather(*tasks)


async def main():

    logging.basicConfig(level=logging.INFO)

    net_connect_limit = 20

    online = False

    reader = Story_reader(online=online)
    main_getter = Main_story_getter(reader, online=online)
    band_getter = Band_story_getter(reader, online=online)
    event_getter = Event_story_getter(reader, online=online)
    card_getter = Card_story_getter(reader, online=online)

    async with ClientSession(
        trust_env=True, connector=TCPConnector(limit=net_connect_limit)
    ) as session:

        await asyncio.gather(
            reader.init(session),
            main_getter.init(session),
            band_getter.init(session),
            event_getter.init(session),
            card_getter.init(session),
        )

        tasks = []

        text_mark_lang = ('cn', 'cn')

        tasks.append(main_getter.get(list(range(1, 4)), *text_mark_lang))
        for i in [1, 2]:
            for j in [1]:
                tasks.append(band_getter.get(i, j, *text_mark_lang))
        for i in range(1, 11):
            tasks.append(event_getter.get(i, *text_mark_lang))
        for i in range(1, 11):
            tasks.append(card_getter.get(i, *text_mark_lang))

        await asyncio.gather(*tasks)


if __name__ == '__main__':
    asyncio.run(main())
