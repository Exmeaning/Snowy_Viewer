# Producer Fixture Source

`index.fixture.json` and `detail.fixture.json` are byte-for-byte copies of
`contracts/public-lyrics/v1/` from canonical NEXTmoetranslation commit
`068f0e4`. Do not hand-edit their schema or wrap them in a consumer-specific
fixture shape.

`detail-vocaloid-only.fixture.json` is a consumer compatibility regression for
the updated v1 schema. It keeps one complete Japanese segment while using legal
empty translations and `performerIds: []`; it is intentionally separate from
the byte-for-byte producer snapshots above.
