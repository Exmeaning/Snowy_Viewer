package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

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

var (
	cardEventMap  = make(map[int]EventInfo)
	musicEventMap = make(map[int][]EventInfo)
	cardGachaMap  = make(map[int][]GachaInfo)

	// Event <-> VirtualLive mappings
	eventVirtualLiveMap = make(map[int]VirtualLiveInfo) // eventId -> VirtualLiveInfo
	virtualLiveEventMap = make(map[int]EventInfo)       // virtualLiveId -> EventInfo

	// Gacha Data
	gachaList    []Gacha
	gachaPickups = make(map[int][]int) // gachaId -> []cardId

	mutex sync.RWMutex
)

const (
	EventsURL      = "https://sekaimaster.exmeaning.com/master/events.json"
	EventCardsURL  = "https://sekaimaster.exmeaning.com/master/eventCards.json"
	EventMusicsURL = "https://sekaimaster.exmeaning.com/master/eventMusics.json"
	// Use GitHub raw content for large data files to avoid stream errors on the mirror
	VirtualLivesURL = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master/virtualLives.json"
	GachasURL       = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master/gachas.json"
)

func fetchJSON(url string, target interface{}) error {
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status: %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, target)
}

func fetchData() error {
	fmt.Println("Fetching master data...")

	var events []Event
	if err := fetchJSON(EventsURL, &events); err != nil {
		return fmt.Errorf("fetch events: %v", err)
	}

	var eventCards []EventCard
	if err := fetchJSON(EventCardsURL, &eventCards); err != nil {
		return fmt.Errorf("fetch eventCards: %v", err)
	}

	var eventMusics []EventMusic
	if err := fetchJSON(EventMusicsURL, &eventMusics); err != nil {
		return fmt.Errorf("fetch eventMusics: %v", err)
	}

	var virtualLives []VirtualLive
	if err := fetchJSON(VirtualLivesURL, &virtualLives); err != nil {
		fmt.Printf("Warning: failed to fetch virtualLives: %v\n", err)
	}

	var gachas []Gacha
	if err := fetchJSON(GachasURL, &gachas); err != nil {
		fmt.Printf("Warning: failed to fetch gachas: %v\n", err)
	}

	// Build Maps
	newCardEventMap := make(map[int]EventInfo)
	newMusicEventMap := make(map[int][]EventInfo)
	eventLookup := make(map[int]Event)
	for _, e := range events {
		eventLookup[e.ID] = e
	}

	for _, ec := range eventCards {
		if ev, ok := eventLookup[ec.EventID]; ok {
			newCardEventMap[ec.CardID] = EventInfo{
				ID:              ev.ID,
				Name:            ev.Name,
				AssetbundleName: ev.AssetbundleName,
			}
		}
	}

	for _, em := range eventMusics {
		if ev, ok := eventLookup[em.EventID]; ok {
			info := EventInfo{
				ID:              ev.ID,
				Name:            ev.Name,
				AssetbundleName: ev.AssetbundleName,
			}
			newMusicEventMap[em.MusicID] = append(newMusicEventMap[em.MusicID], info)
		}
	}

	// Build Virtual Live <-> Event mappings
	virtualLiveLookup := make(map[int]VirtualLive)
	for _, vl := range virtualLives {
		virtualLiveLookup[vl.ID] = vl
	}

	newEventVirtualLiveMap := make(map[int]VirtualLiveInfo)
	newVirtualLiveEventMap := make(map[int]EventInfo)
	for _, e := range events {
		if e.VirtualLiveId > 0 {
			if vl, ok := virtualLiveLookup[e.VirtualLiveId]; ok {
				newEventVirtualLiveMap[e.ID] = VirtualLiveInfo{
					ID:              vl.ID,
					Name:            vl.Name,
					AssetbundleName: vl.AssetbundleName,
				}
				newVirtualLiveEventMap[e.VirtualLiveId] = EventInfo{
					ID:              e.ID,
					Name:            e.Name,
					AssetbundleName: e.AssetbundleName,
				}
			}
		}
	}

	newGachaPickups := make(map[int][]int)
	for _, g := range gachas {
		for _, p := range g.GachaPickups {
			newGachaPickups[g.ID] = append(newGachaPickups[g.ID], p.CardID)
		}
	}

	newCardGachaMap := make(map[int][]GachaInfo)
	for _, g := range gachas {
		info := GachaInfo{
			ID:              g.ID,
			Name:            g.Name,
			AssetbundleName: g.AssetbundleName,
		}
		for _, p := range g.GachaPickups {
			newCardGachaMap[p.CardID] = append(newCardGachaMap[p.CardID], info)
		}
	}

	mutex.Lock()
	cardEventMap = newCardEventMap
	musicEventMap = newMusicEventMap
	cardGachaMap = newCardGachaMap
	eventVirtualLiveMap = newEventVirtualLiveMap
	virtualLiveEventMap = newVirtualLiveEventMap
	gachaList = gachas
	gachaPickups = newGachaPickups
	mutex.Unlock()

	fmt.Printf("Data updated. Mapped %d cards, %d musics, %d event-vl, loaded %d gachas.\n", len(newCardEventMap), len(newMusicEventMap), len(newEventVirtualLiveMap), len(gachas))
	return nil
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Helper to serve 404 page
func serve404(w http.ResponseWriter, root string) {
	notFoundPath := filepath.Join(root, "404.html")
	if content, err := os.ReadFile(notFoundPath); err == nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		w.Write(content)
		return
	}
	http.NotFound(w, nil)
}

func fileServerWithExtensions(root string) http.Handler {
	fs := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := filepath.Clean(r.URL.Path)
		fullPath := filepath.Join(root, cleanPath)

		info, err := os.Stat(fullPath)
		if err == nil {
			if !info.IsDir() {
				fs.ServeHTTP(w, r)
				return
			}
			indexPath := filepath.Join(fullPath, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				fs.ServeHTTP(w, r)
				return
			}
		}

		htmlPath := fullPath + ".html"
		if _, err := os.Stat(htmlPath); err == nil {
			r.URL.Path += ".html"
			fs.ServeHTTP(w, r)
			return
		}

		if filepath.Ext(cleanPath) != "" {
			serve404(w, root)
			return
		}
		serve404(w, root)
	})
}

func main() {
	if err := fetchData(); err != nil {
		fmt.Printf("Initial fetch error: %v\n", err)
	}

	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for range ticker.C {
			if err := fetchData(); err != nil {
				fmt.Printf("Periodic update error: %v\n", err)
			}
		}
	}()

	mux := http.NewServeMux()

	mux.HandleFunc("/api/card-event-map", func(w http.ResponseWriter, r *http.Request) {
		mutex.RLock()
		defer mutex.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cardEventMap)
	})

	mux.HandleFunc("/api/music-event-map", func(w http.ResponseWriter, r *http.Request) {
		mutex.RLock()
		defer mutex.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(musicEventMap)
	})

	mux.HandleFunc("/api/card-gacha-map", func(w http.ResponseWriter, r *http.Request) {
		mutex.RLock()
		defer mutex.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cardGachaMap)
	})

	mux.HandleFunc("/api/event-virtuallive-map", func(w http.ResponseWriter, r *http.Request) {
		mutex.RLock()
		defer mutex.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(eventVirtualLiveMap)
	})

	mux.HandleFunc("/api/virtuallive-event-map", func(w http.ResponseWriter, r *http.Request) {
		mutex.RLock()
		defer mutex.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(virtualLiveEventMap)
	})

	// Local Gacha API Handler
	mux.HandleFunc("/api/gachas", func(w http.ResponseWriter, r *http.Request) {
		mutex.RLock()
		defer mutex.RUnlock()

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
		sortBy := query.Get("sortBy")       // "startAt" or "id"
		sortOrder := query.Get("sortOrder") // "asc" or "desc"

		// Filter
		var filtered []Gacha
		if search == "" {
			filtered = make([]Gacha, len(gachaList))
			copy(filtered, gachaList)
		} else {
			for _, g := range gachaList {
				if strings.Contains(strings.ToLower(g.Name), search) {
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
				// Default startAt
				less = filtered[i].StartAt < filtered[j].StartAt
			}
			if sortOrder == "asc" {
				return less
			}
			return !less // desc
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
		resultItems := make([]GachaListItem, len(paged))
		for i, g := range paged {
			pickups := gachaPickups[g.ID]
			if pickups == nil {
				pickups = []int{}
			}
			resultItems[i] = GachaListItem{
				ID:              g.ID,
				GachaType:       g.GachaType,
				Name:            g.Name,
				AssetbundleName: g.AssetbundleName,
				StartAt:         g.StartAt,
				EndAt:           g.EndAt,
				PickupCardIds:   pickups,
			}
		}

		resp := GachaListResponse{
			Total:  total,
			Page:   page,
			Limit:  limit,
			Gachas: resultItems,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	// Get Single Gacha
	mux.HandleFunc("/api/gachas/", func(w http.ResponseWriter, r *http.Request) {
		mutex.RLock()
		defer mutex.RUnlock()

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

		// Find in list (could use a map for O(1) but list is small enough)
		var found *Gacha
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

		// Construct response (Gacha struct already has most fields, just need to ensure pickups are set)
		// We can reuse the Gacha struct or create a specific response.
		// Since fetchData populates GachaPickups inside the struct, we might need to rely on the map if the struct field isn't fully populated recursively or if we want just IDs.
		// But wait, the frontend wants `pickupCardIds`. The `Gacha` struct has `GachaPickups` (array of objects), but response needs `pickupCardIds` (array of ints).
		// Let's create a response struct or dynamic map.

		type GachaDetailResponse struct {
			Gacha
			PickupCardIds []int `json:"pickupCardIds"`
		}

		pickups := gachaPickups[found.ID]
		if pickups == nil {
			pickups = []int{}
		}

		resp := GachaDetailResponse{
			Gacha:         *found,
			PickupCardIds: pickups,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	// Static
	if _, err := os.Stat("./dist"); !os.IsNotExist(err) {
		fmt.Println("Serving static files from ./dist")
		mux.Handle("/", fileServerWithExtensions("./dist"))
	} else {
		fmt.Println("Warning: ./dist directory not found. Only API will be served.")
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/" {
				fmt.Fprint(w, "Snowy Viewer Backend API Service Running (Static files not found)")
			} else {
				// Use serve404 helper? But we don't have root. Just 404.
				http.NotFound(w, r)
			}
		})
	}

	fmt.Println("Server starting on :8080...")
	if err := http.ListenAndServe(":8080", corsMiddleware(mux)); err != nil {
		fmt.Printf("Error starting server: %s\n", err)
	}
}
