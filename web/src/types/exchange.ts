export type MaterialExchangeType = "normal" | "beginner";
export type MaterialExchangeRefreshCycle = "none" | "monthly";
export type MaterialExchangeCostResourceType = "material" | "mysekai_material";

export type ExchangeStatus = "active" | "upcoming" | "ended" | "permanent";

export interface MaterialExchangeDisplayResourceGroup {
    id: number;
    groupId: number;
    seq: number;
    resourceType: string;
    resourceId: number;
    assetbundleName?: string;
}

export interface MaterialExchangeCost {
    materialExchangeId: number;
    costGroupId: number;
    seq: number;
    resourceType: MaterialExchangeCostResourceType;
    resourceId: number;
    quantity: number;
}

export interface MaterialExchangeRelationChild {
    materialExchangeId: number;
    materialExchangeCostGroupId: number;
}

export interface MaterialExchangeRelationParent {
    id: number;
    description: string;
    assetbundleName?: string;
    materialExchangeRelationChildren: MaterialExchangeRelationChild[];
}

export interface MaterialExchange {
    id: number;
    materialExchangeSummaryId: number;
    seq: number;
    isDisplayQuantity: boolean;
    resourceBoxId: number;
    refreshCycle: MaterialExchangeRefreshCycle;
    exchangeLimit?: number;
    startAt?: number;
    displayName?: string;
    thumbnailAssetbundleName?: string;
    costs: MaterialExchangeCost[];
    materialExchangeRelationParents: MaterialExchangeRelationParent[];
}

export interface MaterialExchangeSummary {
    id: number;
    seq: number;
    exchangeCategory: string;
    materialExchangeType: MaterialExchangeType;
    name: string;
    assetbundleName?: string;
    startAt?: number;
    endAt?: number;
    materialExchangeDisplayResourceGroupId?: number;
    materialExchanges: MaterialExchange[];
    materialExchangeDisplayResourceGroups: MaterialExchangeDisplayResourceGroup[];
}

export interface ExchangeResourceDetail {
    resourceBoxPurpose: string;
    resourceBoxId: number;
    seq: number;
    resourceType: string;
    resourceId?: number;
    resourceLevel?: number;
    resourceQuantity?: number;
}

export interface ExchangeResourceBox {
    resourceBoxPurpose: string;
    id: number;
    resourceBoxType?: string;
    description?: string;
    details: ExchangeResourceDetail[];
}

export interface ResolvedExchangeCost {
    resourceType: MaterialExchangeCostResourceType;
    resourceId: number;
    quantity: number;
    name: string;
    subtitle?: string;
    imageUrl?: string;
}

export interface ResolvedExchangeCostGroup {
    costGroupId: number;
    costs: ResolvedExchangeCost[];
}

export interface ResolvedExchangeRelationParent {
    id: number;
    description: string;
    assetbundleName?: string;
    costGroups: ResolvedExchangeCostGroup[];
}

export interface ResolvedExchangeReward {
    seq: number;
    resourceType: string;
    resourceId?: number;
    quantity: number;
    name: string;
    subtitle?: string;
    imageUrl?: string;
    linkHref?: string;
}

export interface ResolvedExchangeDisplayResource {
    id: number;
    groupId: number;
    seq: number;
    resourceType: string;
    resourceId: number;
    name: string;
    subtitle?: string;
    imageUrl?: string;
}

export interface RewardTypeSummary {
    resourceType: string;
    label: string;
    count: number;
    totalQuantity: number;
}

export interface FlattenedMaterialExchange {
    id: number;
    summaryId: number;
    summarySeq: number;
    summaryName: string;
    summaryAssetbundleName?: string;
    summaryStartAt?: number;
    summaryEndAt?: number;
    summaryDisplayResourceGroupId?: number;
    exchangeCategory: string;
    materialExchangeType: MaterialExchangeType;
    exchangeSeq: number;
    displayName?: string;
    thumbnailAssetbundleName?: string;
    resourceBoxId: number;
    refreshCycle: MaterialExchangeRefreshCycle;
    exchangeLimit?: number;
    exchangeStartAt?: number;
    isDisplayQuantity: boolean;
    costs: MaterialExchangeCost[];
    materialExchangeRelationParents: MaterialExchangeRelationParent[];
    materialExchangeDisplayResourceGroups: MaterialExchangeDisplayResourceGroup[];
    rewardDetails: ExchangeResourceDetail[];
    rewardTypes: string[];
    costTypes: MaterialExchangeCostResourceType[];
    status: ExchangeStatus;
    resolvedTitle: string;
    searchText: string;
}
