package masterdata

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"snowy_viewer/internal/models"
)

const (
	EventsURL         = "https://sekaimaster.exmeaning.com/master/events.json"
	EventCardsURL     = "https://sekaimaster.exmeaning.com/master/eventCards.json"
	EventMusicsURL    = "https://sekaimaster.exmeaning.com/master/eventMusics.json"
	VirtualLivesURL   = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master/virtualLives.json"
	GachasURL         = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master/gachas.json"
	CardCostume3dsURL = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master/cardCostume3ds.json"
	Costume3dsURL     = "https://raw.githubusercontent.com/Team-Haruki/haruki-sekai-master/main/master/costume3ds.json"
)

// Store holds all master data in memory
type Store struct {
	mutex sync.RWMutex

	// Card/Event/Music mappings
	CardEventMap  map[int]models.EventInfo
	MusicEventMap map[int][]models.EventInfo
	CardGachaMap  map[int][]models.GachaInfo

	// Event <-> VirtualLive mappings
	EventVirtualLiveMap map[int]models.VirtualLiveInfo
	VirtualLiveEventMap map[int]models.EventInfo

	// Gacha data
	GachaList    []models.Gacha
	GachaPickups map[int][]int

	// Costume mappings
	CardCostume3dMap    map[int][]int
	Costume3dGroupIdMap map[int]int
	Costume3dGroupMap   map[int][]models.Costume3d

	// Config
	localDataPath string
}

// NewStore creates a new master data store
func NewStore(localDataPath string) *Store {
	return &Store{
		CardEventMap:        make(map[int]models.EventInfo),
		MusicEventMap:       make(map[int][]models.EventInfo),
		CardGachaMap:        make(map[int][]models.GachaInfo),
		EventVirtualLiveMap: make(map[int]models.VirtualLiveInfo),
		VirtualLiveEventMap: make(map[int]models.EventInfo),
		GachaPickups:        make(map[int][]int),
		CardCostume3dMap:    make(map[int][]int),
		Costume3dGroupIdMap: make(map[int]int),
		Costume3dGroupMap:   make(map[int][]models.Costume3d),
		localDataPath:       localDataPath,
	}
}

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

func (s *Store) loadOrFetch(filename string, url string, target interface{}) error {
	localPath := filepath.Join(s.localDataPath, filename)
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
	}
	return fetchJSON(url, target)
}

// Fetch loads all master data from local files or remote
func (s *Store) Fetch() error {
	fmt.Println("Updating master data...")

	var events []models.Event
	if err := s.loadOrFetch("events.json", EventsURL, &events); err != nil {
		return fmt.Errorf("fetch events: %v", err)
	}

	var eventCards []models.EventCard
	if err := s.loadOrFetch("eventCards.json", EventCardsURL, &eventCards); err != nil {
		return fmt.Errorf("fetch eventCards: %v", err)
	}

	var eventMusics []models.EventMusic
	if err := s.loadOrFetch("eventMusics.json", EventMusicsURL, &eventMusics); err != nil {
		return fmt.Errorf("fetch eventMusics: %v", err)
	}

	var virtualLives []models.VirtualLive
	if err := s.loadOrFetch("virtualLives.json", VirtualLivesURL, &virtualLives); err != nil {
		fmt.Printf("Warning: failed to fetch virtualLives: %v\n", err)
	}

	var gachas []models.Gacha
	if err := s.loadOrFetch("gachas.json", GachasURL, &gachas); err != nil {
		fmt.Printf("Warning: failed to fetch gachas: %v\n", err)
	}

	var cardCostume3ds []models.CardCostume3d
	if err := s.loadOrFetch("cardCostume3ds.json", CardCostume3dsURL, &cardCostume3ds); err != nil {
		fmt.Printf("Warning: failed to fetch cardCostume3ds: %v\n", err)
	}

	var costume3ds []models.Costume3d
	if err := s.loadOrFetch("costume3ds.json", Costume3dsURL, &costume3ds); err != nil {
		fmt.Printf("Warning: failed to fetch costume3ds: %v\n", err)
	}

	// Build Maps
	newCardEventMap := make(map[int]models.EventInfo)
	newMusicEventMap := make(map[int][]models.EventInfo)
	eventLookup := make(map[int]models.Event)
	for _, e := range events {
		eventLookup[e.ID] = e
	}

	for _, ec := range eventCards {
		if ev, ok := eventLookup[ec.EventID]; ok {
			newCardEventMap[ec.CardID] = models.EventInfo{
				ID:              ev.ID,
				Name:            ev.Name,
				AssetbundleName: ev.AssetbundleName,
			}
		}
	}

	for _, em := range eventMusics {
		if ev, ok := eventLookup[em.EventID]; ok {
			info := models.EventInfo{
				ID:              ev.ID,
				Name:            ev.Name,
				AssetbundleName: ev.AssetbundleName,
			}
			newMusicEventMap[em.MusicID] = append(newMusicEventMap[em.MusicID], info)
		}
	}

	// Build Virtual Live <-> Event mappings
	virtualLiveLookup := make(map[int]models.VirtualLive)
	for _, vl := range virtualLives {
		virtualLiveLookup[vl.ID] = vl
	}

	newEventVirtualLiveMap := make(map[int]models.VirtualLiveInfo)
	newVirtualLiveEventMap := make(map[int]models.EventInfo)
	for _, e := range events {
		if e.VirtualLiveId > 0 {
			if vl, ok := virtualLiveLookup[e.VirtualLiveId]; ok {
				newEventVirtualLiveMap[e.ID] = models.VirtualLiveInfo{
					ID:              vl.ID,
					Name:            vl.Name,
					AssetbundleName: vl.AssetbundleName,
				}
				newVirtualLiveEventMap[e.VirtualLiveId] = models.EventInfo{
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

	newCardGachaMap := make(map[int][]models.GachaInfo)
	for _, g := range gachas {
		info := models.GachaInfo{
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
	newCostume3dGroupMap := make(map[int][]models.Costume3d)

	for _, cc := range cardCostume3ds {
		newCardCostume3dMap[cc.CardID] = append(newCardCostume3dMap[cc.CardID], cc.Costume3dID)
	}

	for _, c := range costume3ds {
		newCostume3dGroupIdMap[c.ID] = c.Costume3dGroupId
		newCostume3dGroupMap[c.Costume3dGroupId] = append(newCostume3dGroupMap[c.Costume3dGroupId], c)
	}

	// Update store atomically
	s.mutex.Lock()
	s.CardEventMap = newCardEventMap
	s.MusicEventMap = newMusicEventMap
	s.CardGachaMap = newCardGachaMap
	s.EventVirtualLiveMap = newEventVirtualLiveMap
	s.VirtualLiveEventMap = newVirtualLiveEventMap
	s.GachaList = gachas
	s.GachaPickups = newGachaPickups
	s.CardCostume3dMap = newCardCostume3dMap
	s.Costume3dGroupIdMap = newCostume3dGroupIdMap
	s.Costume3dGroupMap = newCostume3dGroupMap
	s.mutex.Unlock()

	fmt.Printf("Data updated. Mapped %d cards, %d musics, %d event-vl, loaded %d gachas, %d costumes.\n",
		len(newCardEventMap), len(newMusicEventMap), len(newEventVirtualLiveMap), len(gachas), len(costume3ds))
	return nil
}

// StartPeriodicUpdate starts a goroutine to update data periodically
func (s *Store) StartPeriodicUpdate(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			if err := s.Fetch(); err != nil {
				fmt.Printf("Periodic update error: %v\n", err)
			}
		}
	}()
}

// Thread-safe getters

func (s *Store) GetCardEventMap() map[int]models.EventInfo {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.CardEventMap
}

func (s *Store) GetMusicEventMap() map[int][]models.EventInfo {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.MusicEventMap
}

func (s *Store) GetCardGachaMap() map[int][]models.GachaInfo {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.CardGachaMap
}

func (s *Store) GetEventVirtualLiveMap() map[int]models.VirtualLiveInfo {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.EventVirtualLiveMap
}

func (s *Store) GetVirtualLiveEventMap() map[int]models.EventInfo {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.VirtualLiveEventMap
}

func (s *Store) GetGachaList() []models.Gacha {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.GachaList
}

func (s *Store) GetGachaPickups() map[int][]int {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.GachaPickups
}

func (s *Store) GetCardCostume3dMap() map[int][]int {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.CardCostume3dMap
}

func (s *Store) GetCostume3dGroupIdMap() map[int]int {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.Costume3dGroupIdMap
}

func (s *Store) GetCostume3dGroupMap() map[int][]models.Costume3d {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.Costume3dGroupMap
}
