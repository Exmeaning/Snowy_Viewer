
export interface IMangaContributors {
    [role: string]: string;
}

export interface IMangaItem {
    id: number;
    title: string;
    manga: string;
    date: number;
    url: string;
    contributors: IMangaContributors;
}

export type IMangaData = Record<string, IMangaItem>;
