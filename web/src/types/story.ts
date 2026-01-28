// Story/Scenario Types for Story Reader
// Based on sekai.best storyreader and scenario JSON structure

// Event Story from master data
export interface IEventStoryEpisode {
    id: number;
    eventStoryId: number;
    episodeNo: number;
    title: string;
    assetbundleName: string;
    scenarioId: string;
    releaseConditionId: number;
    episodeRewards: { storyType: string; resourceBoxId: number }[];
}

export interface IEventStory {
    id: number;
    eventId: number;
    outline: string;
    bannerGameCharacterUnitId: number;
    assetbundleName: string;
    eventStoryEpisodes: IEventStoryEpisode[];
}

// Snippet Action Types (from reference code)

export enum SnippetAction {
    None = 0,
    Talk = 1,
    CharacterLayout = 2,
    InputName = 3,
    SpecialEffect = 4,
    CharacterMotion = 5,
    Sound = 6,
    ChangeBackground = 7,
    Camera = 8,
}

// Special Effect Types
export enum SpecialEffectType {
    None = 0,
    BlackIn = 1,
    BlackOut = 2,
    WhiteIn = 3,
    WhiteOut = 4,
    ChangeBackground = 5,
    Telop = 6,
    FlashbackIn = 7,
    FlashbackOut = 8,
    FullScreenText = 9,
    Movie = 10,
    ShakeScreen = 11,
    ShakeWindow = 12,
    AttachCharacterShader = 18,
    PlayScenarioEffect = 21,
    StopScenarioEffect = 22,
    ChangeCardStill = 23,
    AmbientColorNormal = 25,
    AmbientColorEvening = 26,
    AmbientColorNight = 27,
}

// Sound Play Mode
export enum SoundPlayMode {
    CrossFade = 0,
    Stack = 1,
    Stop = 2,
    Pause = 3,
    Resume = 4,
    CrossFadeOnce = 5,
}

// Snippet Progress Behavior
export enum SnippetProgressBehavior {
    Now = 0,
    WaitUnitilFinished = 1,
}

// Character appearance in scenario
export interface IAppearCharacter {
    Character2dId: number;
    CostumeType: string;
}

// Snippet data structure
export interface ISnippet {
    Index: number;
    Action: SnippetAction;
    ProgressBehavior: SnippetProgressBehavior;
    ReferenceIndex: number;
    Delay: number;
}

// Talk character reference
export interface ITalkCharacter {
    Character2dId: number;
}

// Voice data in talk
export interface IVoice {
    Character2dId: number;
    VoiceId: string;
    Volume: number;
}

// Talk data structure
export interface ITalkData {
    TalkCharacters: ITalkCharacter[];
    WindowDisplayName: string;
    Body: string;
    TalkTention: number;
    LipSync: number;
    MotionChangeFrom: number;
    Motions: unknown[];
    Voices: IVoice[];
    Speed: number;
    FontSize: number;
    WhenFinishCloseWindow: number;
    RequirePlayEffect: number;
    EffectReferenceIdx: number;
    RequirePlaySound: number;
    SoundReferenceIdx: number;
    TargetValueScale: number;
}

// Special effect data
export interface ISpecialEffectData {
    EffectType: SpecialEffectType;
    StringVal: string;
    StringValSub: string;
    Duration: number;
    IntVal: number;
}

// Sound data
export interface ISoundData {
    PlayMode: SoundPlayMode;
    Bgm: string;
    Se: string;
    Volume: number;
    SeBundleName: string;
    Duration: number;
}

// Layout data
export interface ILayoutData {
    Type: number;
    SideFrom: number;
    SideFromOffsetX: number;
    SideTo: number;
    SideToOffsetX: number;
    DepthType: number;
    Character2dId: number;
    CostumeType: string;
    MotionName: string;
    FacialName: string;
    MoveSpeedType: number;
}

// First layout entry
export interface IFirstLayout {
    Character2dId: number;
    CostumeType: string;
    PositionSide: number;
    OffsetX: number;
    MotionName: string;
    FacialName: string;
}

// Main scenario data structure
export interface IScenarioData {
    m_Name: string;
    ScenarioId: string;
    AppearCharacters: IAppearCharacter[];
    FirstLayout: IFirstLayout[];
    FirstBgm: string;
    FirstBackground: string;
    EpisodeMusicVideoId: string;
    Snippets: ISnippet[];
    TalkData: ITalkData[];
    LayoutData: ILayoutData[];
    SpecialEffectData: ISpecialEffectData[];
    SoundData: ISoundData[];
}

// Character 2D info from master data
export interface ICharacter2D {
    id: number;
    characterType: "game_character" | "mob";
    characterId: number;
    unit: string;
    assetName: string;
}

// Mob character info from master data
export interface IMobCharacter {
    id: number;
    seq: number;
    name: string;
    gender: string;
}

// Processed action for display
export interface IProcessedAction {
    type: SnippetAction;
    delay: number;
    isWait: boolean;
    // Talk specific
    chara?: {
        id: number;
        name: string;
    };
    body?: string;
    voice?: string;
    // CN Translation (from event story translation files)
    cnBody?: string;
    cnDisplayName?: string;
    translationSource?: 'official_cn' | 'llm';
    // SpecialEffect specific
    seType?: string;
    resource?: string;
    // Sound specific
    hasBgm?: boolean;
    hasSe?: boolean;
    bgm?: string;
    se?: string;
    playMode?: string;
}

// Processed scenario data for display
export interface IProcessedScenarioData {
    characters: { id: number; name: string }[];
    actions: IProcessedAction[];
}
