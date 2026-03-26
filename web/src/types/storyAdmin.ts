export interface IStoryAdminEvent {
    id: number;
    event_id: number;
    asset_bundle_name: string;
    title_jp: string;
    title_cn: string;
    outline_jp: string;
    outline_cn: string;
    chapter_count: number;
    summary_status: string;
    summary_cn: string;
    cover_image_url?: string;
    created_at: string;
    updated_at: string;
}

export interface IStoryAdminChapter {
    id: number;
    event_id: number;
    chapter_no: number;
    scenario_id: string;
    title_jp: string;
    title_cn: string;
    summary_cn: string;
    asset_bundle_name: string;
    character_ids: string; // JSON string e.g. "[1, 2, 3]"
    created_at: string;
    updated_at: string;
}

// Flattened response based on user feedback
export interface IStoryAdminResponse extends IStoryAdminEvent {
    chapters: IStoryAdminChapter[];
}
