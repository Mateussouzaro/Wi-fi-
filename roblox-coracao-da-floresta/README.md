# Coração da Floresta (Roblox)

Story-mode obby/adventure for Roblox. The whole map is built at runtime by
`src/Server.lua`; `src/Client.lua` runs the story dialogue, objectives and zone lighting.

    python3 build.py            # -> place.rbxlx
    # publish (Open Cloud, key with universe-places:write):
    curl -X POST "https://apis.roblox.com/universes/v1/<UNIVERSE>/places/<PLACE>/versions?versionType=Published" \
      -H "x-api-key: <KEY>" -H "Content-Type: application/xml" --data-binary @place.rbxlx
