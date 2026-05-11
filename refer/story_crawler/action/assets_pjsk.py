import asyncio, sys
from typing import Any

from aiohttp import ClientSession, TCPConnector

import src.pjsk as pjsk

assert sys.argv[1] in ('full', 'incremental')
online = True if sys.argv[1] == 'full' else False

args: dict[str, Any] = {
    'online': online,
    'parse': False,
    'assets_save_dir': '../assets',
    'compress_assets': True,
    'force_master_online': True,
}


reader = pjsk.Story_reader('cn', **args)
event_getter = pjsk.Event_story_getter(reader, **args)
card_getter = pjsk.Card_story_getter(reader, **args)
area_getter = pjsk.Area_talk_getter(reader, **args)
unit_getter = pjsk.Unit_story_getter(reader, **args)
self_getter = pjsk.Self_intro_getter(reader, **args)
special_getter = pjsk.Special_story_getter(reader, **args)

reader_jp = pjsk.Story_reader('jp', mark_lang='en', **args)
event_getter_jp = pjsk.Event_story_getter(reader_jp, **args)
card_getter_jp = pjsk.Card_story_getter(reader_jp, **args)
area_getter_jp = pjsk.Area_talk_getter(reader_jp, **args)
unit_getter_jp = pjsk.Unit_story_getter(reader_jp, **args)
self_getter_jp = pjsk.Self_intro_getter(reader_jp, **args)
special_getter_jp = pjsk.Special_story_getter(reader_jp, **args)

reader_tw = pjsk.Story_reader('tw', **args)
event_getter_tw = pjsk.Event_story_getter(reader_tw, **args)
card_getter_tw = pjsk.Card_story_getter(reader_tw, **args)
area_getter_tw = pjsk.Area_talk_getter(reader_tw, **args)
unit_getter_tw = pjsk.Unit_story_getter(reader_tw, **args)
self_getter_tw = pjsk.Self_intro_getter(reader_tw, **args)
special_getter_tw = pjsk.Special_story_getter(reader_tw, **args)

net_connect_limit = 20


async def main():
    async with ClientSession(
        trust_env=True, connector=TCPConnector(limit=net_connect_limit)
    ) as session:
        await asyncio.gather(
            reader.init(session),
            event_getter.init(session),
            card_getter.init(session),
            area_getter.init(session),
            unit_getter.init(session),
            self_getter.init(session),
            special_getter.init(session),
            reader_jp.init(session),
            event_getter_jp.init(session),
            card_getter_jp.init(session),
            area_getter_jp.init(session),
            unit_getter_jp.init(session),
            self_getter_jp.init(session),
            special_getter_jp.init(session),
            reader_tw.init(session),
            event_getter_tw.init(session),
            card_getter_tw.init(session),
            area_getter_tw.init(session),
            unit_getter_tw.init(session),
            self_getter_tw.init(session),
            special_getter_tw.init(session),
        )

        tasks = []

        # main
        for i in unit_getter.tell_ids():
            tasks.append(unit_getter.get(i))
        for i in unit_getter_jp.tell_ids():
            tasks.append(unit_getter_jp.get(i))
        for i in unit_getter_tw.tell_ids():
            tasks.append(unit_getter_tw.get(i))

        # event
        tasks.append(event_getter.get_newest(0, area_getter=area_getter))
        for i in event_getter_jp.tell_ids():
            tasks.append(event_getter_jp.get(i))
        tasks.append(event_getter_tw.get_newest(0, area_getter=area_getter_tw))

        # card
        tasks.append(card_getter.get_newest(0))
        for i in card_getter_jp.tell_ids():
            tasks.append(card_getter_jp.get(i))
        tasks.append(card_getter_tw.get_newest(0))

        # area
        for i in area_getter.tell_categories():
            if not isinstance(i, int):
                tasks.append(area_getter.get(i))
        for i in area_getter_jp.tell_categories():
            tasks.append(area_getter_jp.get(i))
        for i in area_getter_tw.tell_categories():
            if not isinstance(i, int):
                tasks.append(area_getter_tw.get(i))

        # self
        for i in self_getter.tell_ids():
            tasks.append(self_getter.get(i))
        for i in self_getter_jp.tell_ids():
            tasks.append(self_getter_jp.get(i))
        for i in self_getter_tw.tell_ids():
            tasks.append(self_getter_tw.get(i))

        # special
        for i in special_getter.tell_ids():
            tasks.append(special_getter.get(i))
        for i in special_getter_jp.tell_ids():
            tasks.append(special_getter_jp.get(i))
        for i in special_getter_tw.tell_ids():
            tasks.append(special_getter_tw.get(i))

        await asyncio.gather(*tasks)


if __name__ == '__main__':
    asyncio.run(main())
