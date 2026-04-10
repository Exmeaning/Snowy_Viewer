# for github action

import asyncio

from aiohttp import ClientSession, TCPConnector

import src.pjsk as pjsk

reader = pjsk.Story_reader('cn')
event_getter = pjsk.Event_story_getter(reader, save_dir='../story_event')
card_getter = pjsk.Card_story_getter(reader, save_dir='../story_card')
area_getter = pjsk.Area_talk_getter(reader, save_dir='../story_area')
unit_getter = pjsk.Unit_story_getter(reader, save_dir='../story_unit')
self_getter = pjsk.Self_intro_getter(reader, save_dir='../story_self')
special_getter = pjsk.Special_story_getter(reader, save_dir='../story_special')


reader_jp = pjsk.Story_reader('jp', mark_lang='en')
event_getter_jp = pjsk.Event_story_getter(reader_jp, save_dir='../story_event')
card_getter_jp = pjsk.Card_story_getter(reader_jp, save_dir='../story_card')
area_getter_jp = pjsk.Area_talk_getter(reader_jp, save_dir='../story_area')
unit_getter_jp = pjsk.Unit_story_getter(reader_jp, save_dir='../story_unit')
self_getter_jp = pjsk.Self_intro_getter(reader_jp, save_dir='../story_self')
special_getter_jp = pjsk.Special_story_getter(reader_jp, save_dir='../story_special')

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
