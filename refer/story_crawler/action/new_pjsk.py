# for github action

import asyncio
from datetime import datetime, timedelta, timezone

from aiohttp import ClientSession, TCPConnector

import src.pjsk as pjsk

reader = pjsk.Story_reader('cn')
event_getter = pjsk.Event_story_getter(reader, save_dir='../story_event')
card_getter = pjsk.Card_story_getter(reader, save_dir='../story_card')
area_getter = pjsk.Area_talk_getter(reader, save_dir='../story_area')

reader_jp = pjsk.Story_reader('jp', mark_lang='en')
event_getter_jp = pjsk.Event_story_getter(reader_jp, save_dir='../story_event')
card_getter_jp = pjsk.Card_story_getter(reader_jp, save_dir='../story_card')
area_getter_jp = pjsk.Area_talk_getter(reader_jp, save_dir='../story_area')

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
            reader_jp.init(session),
            event_getter_jp.init(session),
            card_getter_jp.init(session),
            area_getter_jp.init(session),
        )

        now = datetime.now(timezone.utc)
        future_time = now + timedelta(hours=24)
        future_timestamp = future_time.timestamp()
        timestamp13 = int(future_timestamp * 1000)

        tasks = []

        tasks.append(
            event_getter.get_newest(
                10, area_getter=area_getter, timestamp13=timestamp13
            )
        )
        tasks.append(
            event_getter_jp.get_newest(
                10, area_getter=area_getter_jp, timestamp13=timestamp13
            )
        )

        tasks.append(card_getter.get_newest(50, timestamp13=timestamp13))
        tasks.append(card_getter_jp.get_newest(50, timestamp13=timestamp13))

        await asyncio.gather(*tasks)


asyncio.run(main())
