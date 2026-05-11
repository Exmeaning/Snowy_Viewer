import asyncio
from datetime import datetime, timedelta, timezone

from aiohttp import ClientSession, TCPConnector

import src.bang as bang

reader = bang.Story_reader()
main_getter = bang.Main_story_getter(reader, save_dir='../story_{lang}/main')
band_getter = bang.Band_story_getter(reader, save_dir='../story_{lang}/band')
event_getter = bang.Event_story_getter(reader, save_dir='../story_{lang}/event')
card_getter = bang.Card_story_getter(reader, save_dir='../story_{lang}/card')

net_connect_limit = 20

now = datetime.now(timezone.utc)
future_time = now + timedelta(hours=24)
future_timestamp = future_time.timestamp()
timestamp13 = int(future_timestamp * 1000)


async def main():
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

        tasks.append(main_getter.get(None, 'cn'))
        tasks.append(main_getter.get(None, 'jp', 'en'))
        tasks.append(main_getter.get(None, 'tw'))

        tasks.append(band_getter.get(None, None, 'cn'))
        tasks.append(band_getter.get(None, None, 'jp', 'en'))
        tasks.append(band_getter.get(None, None, 'tw'))

        tasks.append(event_getter.get_newest('cn', quantity=0, timestamp13=timestamp13))
        tasks.append(
            event_getter.get_newest('jp', 'en', quantity=0, timestamp13=timestamp13)
        )
        tasks.append(event_getter.get_newest('tw', quantity=0, timestamp13=timestamp13))

        tasks.append(card_getter.get_newest('cn', quantity=0, timestamp13=timestamp13))
        tasks.append(
            card_getter.get_newest('jp', 'en', quantity=0, timestamp13=timestamp13)
        )
        tasks.append(card_getter.get_newest('tw', quantity=0, timestamp13=timestamp13))

        await asyncio.gather(*tasks)


if __name__ == '__main__':
    asyncio.run(main())
