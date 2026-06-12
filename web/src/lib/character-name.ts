type CharacterNameParts = {
    firstName?: string | null;
    givenName?: string | null;
};

export function formatCharacterDisplayName(character: CharacterNameParts): string {
    return `${character.firstName ?? ""}${character.givenName ?? ""}`.trim();
}
