package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"snowy_viewer/internal/masterdata"
	"snowy_viewer/internal/models"
)

const (
	defaultGachaPage     = 1
	defaultGachaLimit    = 24
	maxGachaPage         = 1_000_000
	maxGachaLimit        = 100
	masterDataRetryAfter = "30"
)

// Handler holds dependencies for HTTP handlers
type Handler struct {
	store *masterdata.Store
}

func (h *Handler) requireMasterData(w http.ResponseWriter) bool {
	if h.store.IsReady() {
		return true
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Retry-After", masterDataRetryAfter)
	w.WriteHeader(http.StatusServiceUnavailable)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": "masterdata unavailable"})
	return false
}

// New creates a new Handler instance
func New(store *masterdata.Store) *Handler {
	return &Handler{
		store: store,
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
}

func (h *Handler) handleCardEventMap(w http.ResponseWriter, r *http.Request) {
	if !h.requireMasterData(w) {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.store.GetCardEventMap())
}

func (h *Handler) handleMusicEventMap(w http.ResponseWriter, r *http.Request) {
	if !h.requireMasterData(w) {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.store.GetMusicEventMap())
}

func (h *Handler) handleCardGachaMap(w http.ResponseWriter, r *http.Request) {
	if !h.requireMasterData(w) {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.store.GetCardGachaMap())
}

func (h *Handler) handleEventVirtualLiveMap(w http.ResponseWriter, r *http.Request) {
	if !h.requireMasterData(w) {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.store.GetEventVirtualLiveMap())
}

func (h *Handler) handleVirtualLiveEventMap(w http.ResponseWriter, r *http.Request) {
	if !h.requireMasterData(w) {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.store.GetVirtualLiveEventMap())
}

func (h *Handler) handleGachaList(w http.ResponseWriter, r *http.Request) {
	if !h.requireMasterData(w) {
		return
	}
	// Parse Params
	query := r.URL.Query()
	page, err := parseBoundedPositiveInt(query.Get("page"), defaultGachaPage, maxGachaPage)
	if err != nil {
		writePaginationError(w, err)
		return
	}
	limit, err := parseBoundedPositiveInt(query.Get("limit"), defaultGachaLimit, maxGachaLimit)
	if err != nil {
		writePaginationError(w, err)
		return
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
		asc := sortOrder == "asc"
		left := filtered[i]
		right := filtered[j]

		if sortBy == "id" {
			if left.ID == right.ID {
				if left.StartAt == right.StartAt {
					return false
				}
				if asc {
					return left.StartAt < right.StartAt
				}
				return left.StartAt > right.StartAt
			}
			if asc {
				return left.ID < right.ID
			}
			return left.ID > right.ID
		}

		// Default sort by startAt.
		if left.StartAt == right.StartAt {
			if left.ID == right.ID {
				return false
			}
			if asc {
				return left.ID < right.ID
			}
			return left.ID > right.ID
		}
		if asc {
			return left.StartAt < right.StartAt
		}
		return left.StartAt > right.StartAt
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

func parseBoundedPositiveInt(raw string, fallback, maximum int) (int, error) {
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.ParseUint(raw, 10, 31)
	if err != nil || value < 1 || value > uint64(maximum) {
		return 0, fmt.Errorf("pagination value must be between 1 and %d", maximum)
	}
	return int(value), nil
}

func writePaginationError(w http.ResponseWriter, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}

func (h *Handler) handleGachaDetail(w http.ResponseWriter, r *http.Request) {
	if !h.requireMasterData(w) {
		return
	}
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
