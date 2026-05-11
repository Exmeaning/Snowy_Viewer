import asyncio

from aiohttp import ClientSession, TCPConnector

from .all_bang import reader, event_getter, card_getter, net_connect_limit, timestamp13


async def main():
    async with ClientSession(
        trust_env=True, connector=TCPConnector(limit=net_connect_limit)
    ) as session:
        await asyncio.gather(
            reader.init(session),
            event_getter.init(session),
            card_getter.init(session),
        )
        tasks = []

        tasks.append(
            event_getter.get_newest('cn', quantity=10, timestamp13=timestamp13)
        )
        tasks.append(
            event_getter.get_newest('jp', 'en', quantity=10, timestamp13=timestamp13)
        )
        tasks.append(
            event_getter.get_newest('tw', quantity=10, timestamp13=timestamp13)
        )

        tasks.append(card_getter.get_newest('cn', quantity=50, timestamp13=timestamp13))
        tasks.append(
            card_getter.get_newest('jp', 'en', quantity=50, timestamp13=timestamp13)
        )
        tasks.append(card_getter.get_newest('tw', quantity=50, timestamp13=timestamp13))

        await asyncio.gather(*tasks)


if __name__ == '__main__':
    asyncio.run(main())
