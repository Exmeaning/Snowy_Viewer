# for github action

import asyncio, sys

from aiohttp import ClientSession, TCPConnector

import src.pjsk as pjsk

assert sys.argv[1] in ('full', 'incremental')
online = True if sys.argv[1] == 'full' else False


def fast_call():
    return {
        'online': online,
        'parse': False,
        'assets_save_dir': '../assets',
        'compress_assets': True,
        'force_master_online': True,
    }


reader = pjsk.Story_reader('cn', **fast_call())
event_getter = pjsk.Event_story_getter(reader, **fast_call())
card_getter = pjsk.Card_story_getter(reader, **fast_call())
area_getter = pjsk.Area_talk_getter(reader, **fast_call())
unit_getter = pjsk.Unit_story_getter(reader, **fast_call())
self_getter = pjsk.Self_intro_getter(reader, **fast_call())
special_getter = pjsk.Special_story_getter(reader, **fast_call())


reader_jp = pjsk.Story_reader('jp', mark_lang='en', **fast_call())
event_getter_jp = pjsk.Event_story_getter(reader_jp, **fast_call())
card_getter_jp = pjsk.Card_story_getter(reader_jp, **fast_call())
area_getter_jp = pjsk.Area_talk_getter(reader_jp, **fast_call())
unit_getter_jp = pjsk.Unit_story_getter(reader_jp, **fast_call())
self_getter_jp = pjsk.Self_intro_getter(reader_jp, **fast_call())
special_getter_jp = pjsk.Special_story_getter(reader_jp, **fast_call())

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
        )

        tasks = []

        for i in unit_getter.tell_ids():
            tasks.append(unit_getter.get(i))
        for i in unit_getter_jp.tell_ids():
            tasks.append(unit_getter_jp.get(i))

        tasks.append(event_getter.get_newest(0, area_getter=area_getter))
        tasks.append(event_getter_jp.get_newest(0, area_getter=area_getter_jp))

        tasks.append(card_getter.get_newest(0))
        tasks.append(card_getter_jp.get_newest(0))

        for i in area_getter.tell_categories():
            if not isinstance(i, int):
                tasks.append(area_getter.get(i))
        for i in area_getter_jp.tell_categories():
            if not isinstance(i, int):
                tasks.append(area_getter_jp.get(i))

        for i in self_getter.tell_ids():
            tasks.append(self_getter.get(i))
        for i in self_getter_jp.tell_ids():
            tasks.append(self_getter_jp.get(i))

        for i in special_getter.tell_ids():
            tasks.append(special_getter.get(i))
        for i in special_getter_jp.tell_ids():
            tasks.append(special_getter_jp.get(i))

        await asyncio.gather(*tasks)


asyncio.run(main())
