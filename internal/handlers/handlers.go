package handlers

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"snowy_viewer/internal/bilibili"
	"snowy_viewer/internal/masterdata"
	"snowy_viewer/internal/models"
)

// Handler holds dependencies for HTTP handlers
type Handler struct {
	store    *masterdata.Store
	bilibili *bilibili.Client
}

// New creates a new Handler instance
func New(store *masterdata.Store, biliClient *bilibili.Client) *Handler {
	return &Handler{
		store:    store,
		bilibili: biliClient,
	}
}

// RegisterRoutes registers all API routes
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/card-event-map", h.handleCardEventMap)
	mux.HandleFunc("/api/music-event-map", h.handleMusicEventMap)
	mux.HandleFunc("/api/card-gacha-map", h.handleCardGachaMap)
	mux.HandleFunc("/api/event-virtuallive-map", h.handleEventVirtualLiveMap)
	mux.HandleFunc("/api/virtuallive-event-map", h.handleVirtualLiveEventMap)
	mux.HandleFunc("/api/gachas", h.handleGachaList)
	mux.HandleFunc("/api/gachas/", h.handleGachaDetail)
	mux.HandleFunc("/api/cards/", h.handleCardCostumes)
	mux.HandleFunc("/api/bilibili/dynamic/", h.handleBilibiliDynamic)
	mux.HandleFunc("/api/bilibili/image", h.handleBilibiliImage)
}

func (h *Handler) handleCardEventMap(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.store.GetCardEventMap())
}

func (h *Handler) handleMusicEventMap(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.store.GetMusicEventMap())
}

func (h *Handler) handleCardGachaMap(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.store.GetCardGachaMap())
}

func (h *Handler) handleEventVirtualLiveMap(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.store.GetEventVirtualLiveMap())
}

func (h *Handler) handleVirtualLiveEventMap(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.store.GetVirtualLiveEventMap())
}

func (h *Handler) handleGachaList(w http.ResponseWriter, r *http.Request) {
	// Parse Params
	query := r.URL.Query()
	page, _ := strconv.Atoi(query.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(query.Get("limit"))
	if limit < 1 {
		limit = 24
	}
	search := strings.ToLower(query.Get("search"))
	sortBy := query.Get("sortBy")
	sortOrder := query.Get("sortOrder")

	gachaList := h.store.GetGachaList()
	gachaPickups := h.store.GetGachaPickups()

	// Filter
	var filtered []models.Gacha
	if search == "" {
		filtered = make([]models.Gacha, len(gachaList))
		copy(filtered, gachaList)
	} else {
		searchId, searchIdErr := strconv.Atoi(search)
		for _, g := range gachaList {
			if (searchIdErr == nil && g.ID == searchId) || strings.Contains(strings.ToLower(g.Name), search) {
				filtered = append(filtered, g)
			}
		}
	}

	// Sort
	sort.Slice(filtered, func(i, j int) bool {
		var less bool
		if sortBy == "id" {
			less = filtered[i].ID < filtered[j].ID
		} else {
			less = filtered[i].StartAt < filtered[j].StartAt
		}
		if sortOrder == "asc" {
			return less
		}
		return !less
	})

	// Paginate
	total := len(filtered)
	start := (page - 1) * limit
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}
	paged := filtered[start:end]

	// Map to Response
	resultItems := make([]models.GachaListItem, len(paged))
	for i, g := range paged {
		pickups := gachaPickups[g.ID]
		if pickups == nil {
			pickups = []int{}
		}
		resultItems[i] = models.GachaListItem{
			ID:              g.ID,
			GachaType:       g.GachaType,
			Name:            g.Name,
			AssetbundleName: g.AssetbundleName,
			StartAt:         g.StartAt,
			EndAt:           g.EndAt,
			PickupCardIds:   pickups,
		}
	}

	resp := models.GachaListResponse{
		Total:  total,
		Page:   page,
		Limit:  limit,
		Gachas: resultItems,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) handleGachaDetail(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		http.NotFound(w, r)
		return
	}
	idStr := parts[3]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	gachaList := h.store.GetGachaList()
	gachaPickups := h.store.GetGachaPickups()

	var found *models.Gacha
	for i := range gachaList {
		if gachaList[i].ID == id {
			found = &gachaList[i]
			break
		}
	}

	if found == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Gacha not found"})
		return
	}

	pickups := gachaPickups[found.ID]
	if pickups == nil {
		pickups = []int{}
	}

	resp := models.GachaDetailResponse{
		Gacha:         *found,
		PickupCardIds: pickups,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) handleCardCostumes(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 || parts[4] != "costumes" {
		http.NotFound(w, r)
		return
	}
	cardIdStr := parts[3]
	cardId, err := strconv.Atoi(cardIdStr)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	cardCostume3dMap := h.store.GetCardCostume3dMap()
	costume3dGroupIdMap := h.store.GetCostume3dGroupIdMap()
	costume3dGroupMap := h.store.GetCostume3dGroupMap()

	costumeIds, ok := cardCostume3dMap[cardId]
	if !ok || len(costumeIds) == 0 {
		json.NewEncoder(w).Encode([]models.Costume3d{})
		return
	}

	seenGroupIds := make(map[int]bool)
	var result []models.Costume3d

	for _, cid := range costumeIds {
		groupId, exists := costume3dGroupIdMap[cid]
		if exists {
			if !seenGroupIds[groupId] {
				seenGroupIds[groupId] = true
				if groupItems, ok := costume3dGroupMap[groupId]; ok {
					result = append(result, groupItems...)
				}
			}
		}
	}

	if result == nil {
		result = []models.Costume3d{}
	}

	json.NewEncoder(w).Encode(result)
}

func (h *Handler) handleBilibiliDynamic(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 {
		http.Error(w, "Invalid UID", http.StatusBadRequest)
		return
	}
	uid := parts[4]
	if uid == "" {
		http.Error(w, "Empty UID", http.StatusBadRequest)
		return
	}

	data, statusCode, err := h.bilibili.FetchDynamic(uid)
	if err != nil {
		http.Error(w, err.Error(), statusCode)
		return
	}

	w.WriteHeader(statusCode)
	w.Write(data)
}

func (h *Handler) handleBilibiliImage(w http.ResponseWriter, r *http.Request) {
	imageUrl := r.URL.Query().Get("url")
	if imageUrl == "" {
		http.Error(w, "Missing url parameter", http.StatusBadRequest)
		return
	}

	data, contentType, statusCode, err := h.bilibili.FetchImage(imageUrl)
	if err != nil {
		http.Error(w, err.Error(), statusCode)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=31536000")
	if statusCode == http.StatusOK {
		w.Header().Set("X-Cache", "MISS") // Will be HIT on subsequent requests from cache
	}
	w.WriteHeader(statusCode)
	w.Write(data)
}
