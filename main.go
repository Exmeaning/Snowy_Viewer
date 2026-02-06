package main

import (
	"compress/gzip"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
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
	Costume3dType      string `json:"costume3dType"` // "normal"
	PartType           string `json:"partType"`      // "head", "body", "hair"
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

var (
	cardEventMap  = make(map[int]EventInfo)
	musicEventMap = make(map[int][]EventInfo)
	cardGachaMap  = make(map[int][]GachaInfo)

	// Costume Maps
	cardCostume3dMap    = make(map[int][]int)       // cardId -> []costume3dId
	costume3dGroupIdMap = make(map[int]int)         // costume3dId -> costume3dGroupId
	costume3dGroupMap   = make(map[int][]Costume3d) // costume3dGroupId -> []Costume3d (all variants)

	// Event <-> VirtualLive mappings
	eventVirtualLiveMap = make(map[int]VirtualLiveInfo) // eventId -> VirtualLiveInfo
	virtualLiveEventMap = make(map[int]EventInfo)       // virtualLiveId -> EventInfo

	// Gacha Data
	gachaList    []Gacha
	gachaPickups = make(map[int][]int) // gachaId -> []cardId

	mutex sync.RWMutex

	// Bilibili WBI
	wbiKeys  WbiKeys
	wbiMutex sync.RWMutex

	bilibiliClient *http.Client
)

func init() {
	// Initialize Bilibili Client with CookieJar
	jar, _ := cookiejar.New(nil)
	bilibiliClient = &http.Client{
		Timeout: 10 * time.Second,
		Jar:     jar,
	}
	// Initial cookie fetch
	go func() {
		req, _ := http.NewRequest("GET", "https://www.bilibili.com/", nil)
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		resp, err := bilibiliClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			fmt.Println("Initialized Bilibili cookies")
		} else {
			fmt.Printf("Failed to init cookies: %v\n", err)
		}
	}()
}

// WBI Structs
type WbiKeys struct {
	Img            string
	Sub            string
	Mixin          string
	lastUpdateTime time.Time
}

type NavResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		WbiImg struct {
			ImgUrl string `json:"img_url"`
			SubUrl string `json:"sub_url"`
		} `json:"wbi_img"`
	} `json:"data"`
}

var mixinKeyEncTab = []int{
	46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
	33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
	61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
	36, 20, 34, 44, 52,
}

func getWbiKeys() (WbiKeys, error) {
	wbiMutex.RLock()
	if time.Since(wbiKeys.lastUpdateTime) < 1*time.Hour && wbiKeys.Mixin != "" {
		defer wbiMutex.RUnlock()
		return wbiKeys, nil
	}
	wbiMutex.RUnlock()

	wbiMutex.Lock()
	defer wbiMutex.Unlock()

	// Double check after lock
	if time.Since(wbiKeys.lastUpdateTime) < 1*time.Hour && wbiKeys.Mixin != "" {
		return wbiKeys, nil
	}

	// Use the shared client to reuse cookies
	req, err := http.NewRequest("GET", "https://api.bilibili.com/x/web-interface/nav", nil)
	if err != nil {
		return WbiKeys{}, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := bilibiliClient.Do(req)
	if err != nil {
		return WbiKeys{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return WbiKeys{}, fmt.Errorf("nav api status: %s", resp.Status)
	}

	var nav NavResponse
	if err := json.NewDecoder(resp.Body).Decode(&nav); err != nil {
		return WbiKeys{}, err
	}

	imgUrl := nav.Data.WbiImg.ImgUrl
	subUrl := nav.Data.WbiImg.SubUrl

	if imgUrl == "" || subUrl == "" {
		return WbiKeys{}, fmt.Errorf("empty wbi urls")
	}

	imgKey := strings.TrimSuffix(filepath.Base(imgUrl), ".png")
	subKey := strings.TrimSuffix(filepath.Base(subUrl), ".png")

	// Generate Mixin Key
	rawWbiKey := imgKey + subKey
	var mixin []byte
	for _, index := range mixinKeyEncTab {
		if index < len(rawWbiKey) {
			mixin = append(mixin, rawWbiKey[index])
		}
	}

	wbiKeys.Img = imgKey
	wbiKeys.Sub = subKey
	wbiKeys.Mixin = string(mixin[:32])
	wbiKeys.lastUpdateTime = time.Now()

	return wbiKeys, nil
}

func signWbi(params url.Values) (string, error) {
	keys, err := getWbiKeys()
	if err != nil {
		return "", err
	}

	params.Set("wts", strconv.FormatInt(time.Now().Unix(), 10))

	// Sort keys
	keysList := make([]string, 0, len(params))
	for k := range params {
		keysList = append(keysList, k)
	}
	sort.Strings(keysList)

	// Build query string
	var sb strings.Builder
	for i, k := range keysList {
		if i > 0 {
			sb.WriteString("&")
		}
		// Encode key and value safely
		// Note: params.Encode() sorts and encodes, but we need to control the order and specific encoding if necessary.
		// Detailed docs say standard URL encoding is mostly fine but specific chars might need handling.
		// Go's url.Values.Encode() does sorting and encoding.
		// However, we need to append mixin key at the end of the string used for md5.
		// Let's use url.Values.Encode() but we need to ensure we don't double encode or simpler approach using the sorted keys.
		// Bilibili WBI requires standard URL encoding.

		val := params.Get(k)
		// We need to encode key and value.
		// Go's url.QueryEscape escapes spaces as "+", but we might need "%20".
		// Bilibili doc says spaces should be %20.
		sb.WriteString(url.QueryEscape(k))
		sb.WriteString("=")
		sb.WriteString(url.QueryEscape(val))
		// Note: url.QueryEscape actually encodes space as "+". PathEscape encodes as "%20".
		// But in query parameters usually + is fine unless Bilibili is strict.
		// The python demo uses `urllib.parse.urlencode` which quotes.
		// The Go demo uses `values.Encode()`.
	}

	// Re-construct query string using built-in Encode which sorts
	queryStr := params.Encode()

	// Calculate w_rid
	hash := md5.Sum([]byte(queryStr + keys.Mixin))
	w_rid := hex.EncodeToString(hash[:])

	params.Set("w_rid", w_rid)
	return params.Encode(), nil
}

// Memory Cache for Dynamic Feed
type DynamicCacheItem struct {
	Data      []byte
	ExpiresAt time.Time
}

var (
	dynamicCache = make(map[string]DynamicCacheItem)
	cacheMutex   sync.RWMutex
)

const (
	EventsURL      = "https://sekaimaster.exmeaning.com/master/events.json"
	EventCardsURL  = "https://sekaimaster.exmeaning.com/master/eventCards.json"
	EventMusicsURL = "https://sekaimaster.exmeaning.com/master/eventMusics.json"
	// Use GitHub raw content for large data files to avoid stream errors on the mirror
	VirtualLivesURL   = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master/virtualLives.json"
	GachasURL         = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master/gachas.json"
	CardCostume3dsURL = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master/cardCostume3ds.json"
	Costume3dsURL     = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master/costume3ds.json"
)

const (
	LocalMasterDataPath = "./data/master"
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

func loadOrFetch(filename string, url string, target interface{}) error {
	localPath := filepath.Join(LocalMasterDataPath, filename)
	if _, err := os.Stat(localPath); err == nil {
		content, err := os.ReadFile(localPath)
		if err == nil {
			if err := json.Unmarshal(content, target); err == nil {
				fmt.Printf("Loaded %s from local file\n", filename)
				return nil
			} else {
				fmt.Printf("Warning: failed to unmarshal local %s: %v. Falling back to remote.\n", filename, err)
			}
		} else {
			fmt.Printf("Warning: failed to read local %s: %v. Falling back to remote.\n", filename, err)
		}
	} else {
		// fmt.Printf("Local file %s not found. Falling back to remote.\n", filename)
	}

	return fetchJSON(url, target)
}

func fetchData() error {
	fmt.Println("Updating master data...")

	var events []Event
	if err := loadOrFetch("events.json", EventsURL, &events); err != nil {
		return fmt.Errorf("fetch events: %v", err)
	}

	var eventCards []EventCard
	if err := loadOrFetch("eventCards.json", EventCardsURL, &eventCards); err != nil {
		return fmt.Errorf("fetch eventCards: %v", err)
	}

	var eventMusics []EventMusic
	if err := loadOrFetch("eventMusics.json", EventMusicsURL, &eventMusics); err != nil {
		return fmt.Errorf("fetch eventMusics: %v", err)
	}

	var virtualLives []VirtualLive
	if err := loadOrFetch("virtualLives.json", VirtualLivesURL, &virtualLives); err != nil {
		fmt.Printf("Warning: failed to fetch virtualLives: %v\n", err)
	}

	var gachas []Gacha
	if err := loadOrFetch("gachas.json", GachasURL, &gachas); err != nil {
		fmt.Printf("Warning: failed to fetch gachas: %v\n", err)
	}

	var cardCostume3ds []CardCostume3d
	if err := loadOrFetch("cardCostume3ds.json", CardCostume3dsURL, &cardCostume3ds); err != nil {
		fmt.Printf("Warning: failed to fetch cardCostume3ds: %v\n", err)
	}

	var costume3ds []Costume3d
	if err := loadOrFetch("costume3ds.json", Costume3dsURL, &costume3ds); err != nil {
		fmt.Printf("Warning: failed to fetch costume3ds: %v\n", err)
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

	// Build Costume Maps
	newCardCostume3dMap := make(map[int][]int)
	newCostume3dGroupIdMap := make(map[int]int)
	newCostume3dGroupMap := make(map[int][]Costume3d)

	// 1. Map Card -> Costume3dIDs
	for _, cc := range cardCostume3ds {
		newCardCostume3dMap[cc.CardID] = append(newCardCostume3dMap[cc.CardID], cc.Costume3dID)
	}

	// 2. Process Costumes
	// We want to group by GroupID.
	for _, c := range costume3ds {
		newCostume3dGroupIdMap[c.ID] = c.Costume3dGroupId
		newCostume3dGroupMap[c.Costume3dGroupId] = append(newCostume3dGroupMap[c.Costume3dGroupId], c)
	}

	mutex.Lock()
	cardEventMap = newCardEventMap
	musicEventMap = newMusicEventMap
	cardGachaMap = newCardGachaMap
	eventVirtualLiveMap = newEventVirtualLiveMap
	virtualLiveEventMap = newVirtualLiveEventMap
	gachaList = gachas
	gachaPickups = newGachaPickups
	cardCostume3dMap = newCardCostume3dMap
	costume3dGroupIdMap = newCostume3dGroupIdMap
	costume3dGroupMap = newCostume3dGroupMap
	mutex.Unlock()

	fmt.Printf("Data updated. Mapped %d cards, %d musics, %d event-vl, loaded %d gachas, %d costumes.\n", len(newCardEventMap), len(newMusicEventMap), len(newEventVirtualLiveMap), len(gachas), len(costume3ds))
	return nil
}

// Gzip Middleware
type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

func gzipMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		gz := gzip.NewWriter(w)
		defer gz.Close()
		gzw := gzipResponseWriter{Writer: gz, ResponseWriter: w}
		next.ServeHTTP(gzw, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// ... existing cors headers ...
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		// Wrap gzip inside cors? or vice versa?
		// Usually Cors -> Gzip -> Handler
		// But here we are applying middlewares in ListenAndServe.
		// Let's keep cors simpler and apply gzip in main.
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
			// Check if search query is a valid ID
			searchId, searchIdErr := strconv.Atoi(search)
			for _, g := range gachaList {
				// Match by ID or by name
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

	// Get Card Costumes
	mux.HandleFunc("/api/cards/", func(w http.ResponseWriter, r *http.Request) {
		// Expects /api/cards/{id}/costumes
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

		mutex.RLock()
		defer mutex.RUnlock()

		w.Header().Set("Content-Type", "application/json")

		// 1. Get Costume3dIDs for this card
		costumeIds, ok := cardCostume3dMap[cardId]
		if !ok || len(costumeIds) == 0 {
			json.NewEncoder(w).Encode([]Costume3d{}) // Empty array
			return
		}

		// 2. Find Groups and Collect all Variants
		// We use a map to deduplicate groups (though usually a card refers to a specific costume ID which belongs to a group, and we want the WHOLE group)
		// Wait, if a card has multiple costumes (e.g. hair and body?), we want all of them.

		seenGroupIds := make(map[int]bool)
		var result []Costume3d

		for _, cid := range costumeIds {
			groupId, exists := costume3dGroupIdMap[cid]
			if exists {
				if !seenGroupIds[groupId] {
					seenGroupIds[groupId] = true
					// Append all items from this group
					if groupItems, ok := costume3dGroupMap[groupId]; ok {
						result = append(result, groupItems...)
					}
				}
			}
		}

		// Sort result? Maybe by ID or Seq (if available).
		// For now just return as is.
		if result == nil {
			result = []Costume3d{}
		}

		json.NewEncoder(w).Encode(result)
	})

	// Bilibili Dynamic Proxy
	mux.HandleFunc("/api/bilibili/dynamic/", func(w http.ResponseWriter, r *http.Request) {
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

		// Check Cache
		cacheKey := "dynamic_" + uid
		cacheMutex.RLock()
		if item, ok := dynamicCache[cacheKey]; ok {
			if time.Now().Before(item.ExpiresAt) {
				cacheMutex.RUnlock()
				w.Write(item.Data)
				return
			}
		}
		cacheMutex.RUnlock()

		// Prepare Request
		params := url.Values{}
		params.Set("host_mid", uid)
		params.Set("platform", "web")
		params.Set("web_location", "0.0")
		params.Set("dm_img_list", "[]") // Minimal mock
		params.Set("dm_img_str", "V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ")
		params.Set("dm_cover_img_str", "QU5HTEUgKEFNRCwgQU1EIFJhZGVvbiA3ODBNIEdyYXBoaWNzICgweDAwMDAxNUJGKSBEaXJlY3QzRDExIHZzXzVfMCBwc181XzAsIEQzRDExKUdvb2dsZSBJbmMuIChBTU")

		// Add full features as requested by user to ensure text (OPUS) is returned
		params.Set("features", "itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,forwardListHidden,decorationCard,commentsNewVersion,onlyfansAssetsV2,ugcDelete,onlyfansQaCard,avatarAutoTheme,sunflowerStyle,cardsEnhance,eva3CardOpus,eva3CardVideo,eva3CardComment,eva3CardUser")

		signedQuery, err := signWbi(params)
		if err != nil {
			http.Error(w, fmt.Sprintf("WBI Sign Error: %v", err), http.StatusInternalServerError)
			return
		}

		targetUrl := "https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?" + signedQuery

		req, err := http.NewRequest("GET", targetUrl, nil)
		if err != nil {
			http.Error(w, fmt.Sprintf("Request Creation Error: %v", err), http.StatusInternalServerError)
			return
		}

		// Set Headers to look like a browser
		// Set Headers to look like a browser
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Referer", "https://space.bilibili.com/"+uid+"/dynamic")
		req.Header.Set("Origin", "https://space.bilibili.com")
		req.Header.Set("Accept", "application/json, text/plain, */*")
		req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

		// Add Cookies (SESSDATA is critical for avoiding -412)
		// Check environment variable first
		if sessData := os.Getenv("BILIBILI_SESSDATA"); sessData != "" {
			req.AddCookie(&http.Cookie{Name: "SESSDATA", Value: sessData})
		}
		// Also allowed: Full cookie string in BILIBILI_COOKIE
		if cookieStr := os.Getenv("BILIBILI_COOKIE"); cookieStr != "" {
			req.Header.Set("Cookie", cookieStr)
		}

		client := bilibiliClient
		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, fmt.Sprintf("Bilibili API Error: %v", err), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			http.Error(w, "Failed to read response", http.StatusInternalServerError)
			return
		}

		// Cache Success Response
		if resp.StatusCode == http.StatusOK {
			// Basic check if it's a valid JSON
			var check map[string]interface{}
			if err := json.Unmarshal(body, &check); err == nil {
				// Access code
				if code, ok := check["code"].(float64); ok && code == 0 {
					cacheMutex.Lock()
					dynamicCache[cacheKey] = DynamicCacheItem{
						Data:      body,
						ExpiresAt: time.Now().Add(10 * time.Minute),
					}
					cacheMutex.Unlock()
				}
			}
		}

		w.WriteHeader(resp.StatusCode)
		w.Write(body)
	})

	// Bilibili Image Cache
	type ImageCacheItem struct {
		Data        []byte
		ContentType string
		ExpiresAt   time.Time
	}
	var (
		imageCache = make(map[string]ImageCacheItem)
		imgMutex   sync.RWMutex
	)

	// Bilibili Image Proxy
	mux.HandleFunc("/api/bilibili/image", func(w http.ResponseWriter, r *http.Request) {
		imageUrl := r.URL.Query().Get("url")
		if imageUrl == "" {
			http.Error(w, "Missing url parameter", http.StatusBadRequest)
			return
		}

		// Check Cache
		imgMutex.RLock()
		if item, ok := imageCache[imageUrl]; ok {
			if time.Now().Before(item.ExpiresAt) {
				w.Header().Set("Content-Type", item.ContentType)
				w.Header().Set("Cache-Control", "public, max-age=31536000")
				w.Header().Set("X-Cache", "HIT")
				w.Write(item.Data)
				imgMutex.RUnlock()
				return
			}
		}
		imgMutex.RUnlock()

		// Create request to Bilibili
		req, err := http.NewRequest("GET", imageUrl, nil)
		if err != nil {
			http.Error(w, "Invalid URL", http.StatusBadRequest)
			return
		}

		// Set Referer to bypass hotlinking protection
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Referer", "https://www.bilibili.com/")

		resp, err := bilibiliClient.Do(req)
		if err != nil {
			http.Error(w, "Failed to fetch image", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		data, err := io.ReadAll(resp.Body)
		if err != nil {
			http.Error(w, "Failed to read image", http.StatusInternalServerError)
			return
		}

		// Cache Success Response (Cache for 10 minutes to save memory, client caches for 1 year)
		// Or since user asked explicitly for cache, maybe they want it to persist longer during session?
		// Let's do 1 hour server-side.
		if resp.StatusCode == http.StatusOK {
			imgMutex.Lock()
			// Simple eviction if too big (e.g. > 1000 items)
			if len(imageCache) > 1000 {
				// Random eviction or just clear half? Clearing half is easiest.
				count := 0
				for k := range imageCache {
					delete(imageCache, k)
					count++
					if count > 500 {
						break
					}
				}
			}
			imageCache[imageUrl] = ImageCacheItem{
				Data:        data,
				ContentType: resp.Header.Get("Content-Type"),
				ExpiresAt:   time.Now().Add(1 * time.Hour),
			}
			imgMutex.Unlock()
		}

		// Copy headers
		w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
		w.Header().Set("Cache-Control", "public, max-age=31536000") // Cache for 1 year
		w.Header().Set("X-Cache", "MISS")

		w.WriteHeader(resp.StatusCode)
		w.Write(data)
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
	// Chain middlewares: CORS -> Gzip -> Mux
	handler := gzipMiddleware(corsMiddleware(mux))
	if err := http.ListenAndServe(":8080", handler); err != nil {
		fmt.Printf("Error starting server: %s\n", err)
	}
}
