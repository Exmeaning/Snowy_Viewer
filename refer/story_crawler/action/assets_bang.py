import asyncio, sys
from typing import Any

from aiohttp import ClientSession, TCPConnector

import src.bang as bang

assert sys.argv[1] in ('full', 'incremental')
online = True if sys.argv[1] == 'full' else False

args: dict[str, Any] = {
    'online': online,
    'parse': False,
    'assets_save_dir': '../assets',
    'compress_assets': True,
    'force_master_online': True,
}

reader = bang.Story_reader(**args)
main_getter = bang.Main_story_getter(reader, **args)
band_getter = bang.Band_story_getter(reader, **args)
event_getter = bang.Event_story_getter(reader, **args)
card_getter = bang.Card_story_getter(reader, **args)

net_connect_limit = 20


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

        tasks.append(event_getter.get_newest('cn', quantity=0))
        tasks.append(event_getter.get_newest('jp', 'en', quantity=0))
        tasks.append(event_getter.get_newest('tw', quantity=0))

        tasks.append(card_getter.get_newest('cn', quantity=0))
        tasks.append(card_getter.get_newest('jp', 'en', quantity=0))
        tasks.append(card_getter.get_newest('tw', quantity=0))

        await asyncio.gather(*tasks)


if __name__ == '__main__':
    asyncio.run(main())
