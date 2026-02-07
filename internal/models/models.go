package models

// Master Data Structs
type Event struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	AssetbundleName string `json:"assetbundleName"`
	VirtualLiveId   int    `json:"virtualLiveId"`
}

type EventMusic struct {
	EventID int `json:"eventId"`
	MusicID int `json:"musicId"`
	Seq     int `json:"seq"`
}

type EventCard struct {
	ID      int `json:"id"`
	CardID  int `json:"cardId"`
	EventID int `json:"eventId"`
}

type VirtualLive struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	AssetbundleName string `json:"assetbundleName"`
}

type EventInfo struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	AssetbundleName string `json:"assetbundleName"`
}

type VirtualLiveInfo struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	AssetbundleName string `json:"assetbundleName"`
}

type GachaInfo struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	AssetbundleName string `json:"assetbundleName"`
}

// Gacha Structs
type Gacha struct {
	ID                   int                   `json:"id"`
	GachaType            string                `json:"gachaType"`
	Name                 string                `json:"name"`
	Seq                  int                   `json:"seq"`
	AssetbundleName      string                `json:"assetbundleName"`
	StartAt              int64                 `json:"startAt"`
	EndAt                int64                 `json:"endAt"`
	GachaPickups         []GachaPickup         `json:"gachaPickups"`
	GachaCardRarityRates []GachaCardRarityRate `json:"gachaCardRarityRates"`
}

type GachaCardRarityRate struct {
	ID             int     `json:"id"`
	GachaID        int     `json:"gachaId"`
	CardRarityType string  `json:"cardRarityType"`
	Rate           float64 `json:"rate"`
}

type GachaPickup struct {
	GachaID int `json:"gachaId"`
	CardID  int `json:"cardId"`
}

// Costume Structs
type CardCostume3d struct {
	CardID      int `json:"cardId"`
	Costume3dID int `json:"costume3dId"`
}

type Costume3d struct {
	ID                 int    `json:"id"`
	Costume3dGroupId   int    `json:"costume3dGroupId"`
	Name               string `json:"name"`
	AssetbundleName    string `json:"assetbundleName"`
	Costume3dRarity    string `json:"costume3dRarity"`
	Costume3dType      string `json:"costume3dType"`
	PartType           string `json:"partType"`
	CharacterId        int    `json:"characterId"`
	ColorId            int    `json:"colorId"`
	ArchivePublishedAt int64  `json:"archivePublishedAt"`
}

// Response Structs
type GachaListItem struct {
	ID              int    `json:"id"`
	GachaType       string `json:"gachaType"`
	Name            string `json:"name"`
	AssetbundleName string `json:"assetbundleName"`
	StartAt         int64  `json:"startAt"`
	EndAt           int64  `json:"endAt"`
	PickupCardIds   []int  `json:"pickupCardIds"`
}

type GachaListResponse struct {
	Total  int             `json:"total"`
	Page   int             `json:"page"`
	Limit  int             `json:"limit"`
	Gachas []GachaListItem `json:"gachas"`
}

type GachaDetailResponse struct {
	Gacha
	PickupCardIds []int `json:"pickupCardIds"`
}
