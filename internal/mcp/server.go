package mcp

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
)

var characterNames = map[int]string{
	1: "星乃一歌", 2: "天马咲希", 3: "望月穗波", 4: "日野森志步",
	5: "花里实乃理", 6: "桐谷遥", 7: "桃井爱莉", 8: "日野森雫",
	9: "小豆泽心羽", 10: "白石杏", 11: "东云彰人", 12: "青柳冬弥",
	13: "天马司", 14: "凤笑梦", 15: "草薙宁宁", 16: "神代类",
	17: "宵崎奏", 18: "朝比奈真冬", 19: "东云绘名", 20: "晓山瑞希",
	21: "初音未来", 22: "镜音铃", 23: "镜音连", 24: "巡音流歌",
	25: "MEIKO", 26: "KAITO",
}

var characterUnits = map[int]string{
	1: "Leo/need", 2: "Leo/need", 3: "Leo/need", 4: "Leo/need",
	5: "MORE MORE JUMP！", 6: "MORE MORE JUMP！", 7: "MORE MORE JUMP！", 8: "MORE MORE JUMP！",
	9: "Vivid BAD SQUAD", 10: "Vivid BAD SQUAD", 11: "Vivid BAD SQUAD", 12: "Vivid BAD SQUAD",
	13: "Wonderlands×Showtime", 14: "Wonderlands×Showtime", 15: "Wonderlands×Showtime", 16: "Wonderlands×Showtime",
	17: "25点，Nightcord见。", 18: "25点，Nightcord见。", 19: "25点，Nightcord见。", 20: "25点，Nightcord见。",
	21: "虚拟歌手 (VIRTUAL SINGER)", 22: "虚拟歌手 (VIRTUAL SINGER)", 23: "虚拟歌手 (VIRTUAL SINGER)",
	24: "虚拟歌手 (VIRTUAL SINGER)", 25: "虚拟歌手 (VIRTUAL SINGER)", 26: "虚拟歌手 (VIRTUAL SINGER)",
}

type CardPowerItem struct {
	Performance int `json:"performance"`
	Technique   int `json:"technique"`
	Stamina     int `json:"stamina"`
	Total       int `json:"total"`
}

type CardPowerMeta struct {
	Normal  *CardPowerItem `json:"normal,omitempty"`
	Trained *CardPowerItem `json:"trained,omitempty"`
}

type CardEventMeta struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Asset string `json:"asset"`
}

type CardItem struct {
	ID          int            `json:"id"`
	Prefix      string         `json:"prefix"`
	CharacterID int            `json:"characterId"`
	Rarity      string         `json:"rarity"`
	Attr        string         `json:"attr"`
	Asset       string         `json:"asset"`
	ReleaseAt   int64          `json:"releaseAt,omitempty"`
	SkillName   string         `json:"skillName,omitempty"`
	SkillDesc   string         `json:"skillDesc,omitempty"`
	Power       *CardPowerMeta `json:"power,omitempty"`
	Event       *CardEventMeta `json:"event,omitempty"`
}

type MusicItem struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	Lyricist string `json:"lyricist,omitempty"`
	Composer string `json:"composer,omitempty"`
	Asset    string `json:"asset,omitempty"`
}

type EventItem struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Type    string `json:"type,omitempty"`
	Asset   string `json:"asset,omitempty"`
	StartAt int64  `json:"startAt,omitempty"`
	EndAt   int64  `json:"endAt,omitempty"`
}

type Server struct {
	mu     sync.RWMutex
	cards  map[int]*CardItem
	musics map[int]*MusicItem
	events map[int]*EventItem
}

func New() *Server {
	s := &Server{
		cards:  make(map[int]*CardItem),
		musics: make(map[int]*MusicItem),
		events: make(map[int]*EventItem),
	}
	s.loadMetadata()
	return s
}

func (s *Server) loadMetadata() {
	candidates := []string{
		"/app/nextjs/web/public/data",
		"./web/public/data",
		"../web/public/data",
		"./public/data",
	}

	var dataDir string
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			dataDir = c
			break
		}
	}
	if dataDir == "" {
		return
	}

	loadMap := func(filename string) {
		path := filepath.Join(dataDir, filename)
		data, err := os.ReadFile(path)
		if err != nil {
			return
		}

		var payload struct {
			Cards  map[string]CardItem  `json:"cards"`
			Musics map[string]MusicItem `json:"musics"`
			Events map[string]EventItem `json:"events"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}

		s.mu.Lock()
		defer s.mu.Unlock()

		for k, card := range payload.Cards {
			id, _ := strconv.Atoi(k)
			if id > 0 {
				c := card
				c.ID = id
				s.cards[id] = &c
			}
		}
		for k, music := range payload.Musics {
			id, _ := strconv.Atoi(k)
			if id > 0 {
				m := music
				m.ID = id
				s.musics[id] = &m
			}
		}
		for k, event := range payload.Events {
			id, _ := strconv.Atoi(k)
			if id > 0 {
				e := event
				e.ID = id
				s.events[id] = &e
			}
		}
	}

	// Load JP base then overlay CN translations
	loadMap("metadata-map.json")
	loadMap("metadata-map.cn.json")
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/mcp", s.ServeHTTP)
	mux.HandleFunc("/api/mcp/", s.ServeHTTP)
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method == http.MethodGet {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"name":            "Moesekai MCP Server",
			"version":         "1.0.0",
			"protocolVersion": "2024-11-05",
			"status":          "ready",
			"transport":       "streamable-http",
			"description":     "Project SEKAI: Colorful Stage! AI Agent Data Engine. Send JSON-RPC 2.0 POST requests to this endpoint.",
			"tools_count":     6,
			"resources_count": 2,
		})
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeRPCError(w, nil, -32700, "Parse error", nil)
		return
	}

	s.handleRPC(w, &req)
}

func (s *Server) handleRPC(w http.ResponseWriter, req *Request) {
	switch req.Method {
	case "initialize":
		res := InitializeResult{
			ProtocolVersion: "2024-11-05",
			Capabilities: ServerCapabilities{
				Tools:     ToolsCapability{ListChanged: false},
				Resources: ResourcesCapability{Subscribe: false, ListChanged: false},
			},
			ServerInfo: ServerInfo{
				Name:    "Moesekai MCP",
				Version: "1.0.0",
			},
		}
		s.writeRPCResult(w, req.ID, res)

	case "notifications/initialized":
		s.writeRPCResult(w, req.ID, map[string]interface{}{})

	case "ping":
		s.writeRPCResult(w, req.ID, map[string]interface{}{})

	case "tools/list":
		tools := s.getToolsList()
		s.writeRPCResult(w, req.ID, ToolsListResult{Tools: tools})

	case "tools/call":
		var params ToolCallParams
		if len(req.Params) > 0 {
			_ = json.Unmarshal(req.Params, &params)
		}
		result := s.executeTool(params.Name, params.Arguments)
		s.writeRPCResult(w, req.ID, result)

	case "resources/list":
		res := ResourcesListResult{
			Resources: []Resource{
				{
					URI:         "pjsk://characters",
					Name:        "Project SEKAI Character Directory",
					Description: "List of all 26 characters in Project SEKAI with IDs, names, and bands",
					MimeType:    "application/json",
				},
				{
					URI:         "pjsk://events/latest",
					Name:        "Latest Event Summary",
					Description: "Summary of recent Project SEKAI in-game events",
					MimeType:    "application/json",
				},
			},
		}
		s.writeRPCResult(w, req.ID, res)

	case "resources/read":
		var params ResourceReadParams
		if len(req.Params) > 0 {
			_ = json.Unmarshal(req.Params, &params)
		}
		content := s.readResource(params.URI)
		s.writeRPCResult(w, req.ID, ResourceReadResult{Contents: content})

	default:
		s.writeRPCError(w, req.ID, -32601, fmt.Sprintf("Method not found: %s", req.Method), nil)
	}
}

func (s *Server) writeRPCResult(w http.ResponseWriter, id interface{}, result interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(Response{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	})
}

func (s *Server) writeRPCError(w http.ResponseWriter, id interface{}, code int, message string, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(Response{
		JSONRPC: "2.0",
		ID:      id,
		Error: &RPCError{
			Code:    code,
			Message: message,
			Data:    data,
		},
	})
}

func (s *Server) getToolsList() []Tool {
	return []Tool{
		{
			Name:        "search_cards",
			Description: "Search Project SEKAI cards by character name, card title prefix, rarity (rarity_1 to rarity_4, rarity_birthday), or attribute (cool, cute, happy, mysterious, pure).",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Keyword to search in character name or card prefix/title",
					},
					"character_id": map[string]interface{}{
						"type":        "integer",
						"description": "Filter by character ID (1 to 26)",
					},
					"rarity": map[string]interface{}{
						"type":        "string",
						"description": "Filter by card rarity: rarity_1, rarity_2, rarity_3, rarity_4, rarity_birthday",
					},
					"attribute": map[string]interface{}{
						"type":        "string",
						"description": "Filter by attribute: cool, cute, happy, mysterious, pure",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Maximum number of cards to return (default: 10, max: 30)",
					},
				},
			},
		},
		{
			Name:        "get_card_detail",
			Description: "Get detailed stats, skill name, full skill effect description, normal/trained performance/technique/stamina/total power, and associated event for a specific card by its numerical ID.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"card_id": map[string]interface{}{
						"type":        "integer",
						"description": "Card ID (e.g. 1, 4, 115)",
					},
				},
				"required": []string{"card_id"},
			},
		},
		{
			Name:        "search_musics",
			Description: "Search songs in Project SEKAI by title, lyricist, or composer.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Search keyword for song title, lyricist, or composer",
					},
					"limit": map[string]interface{}{
						"type":        "integer",
						"description": "Maximum number of songs to return (default: 10, max: 30)",
					},
				},
			},
		},
		{
			Name:        "get_music_detail",
			Description: "Get song details including lyricist, composer, and official assets by numerical music ID.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"music_id": map[string]interface{}{
						"type":        "integer",
						"description": "Music ID (e.g. 1)",
					},
				},
				"required": []string{"music_id"},
			},
		},
		{
			Name:        "get_event_info",
			Description: "Get details for an event in Project SEKAI including name, event type (Marathon, Cheer, Carnival), and dates.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"event_id": map[string]interface{}{
						"type":        "integer",
						"description": "Event ID (e.g. 1, 2, 100). Leave empty to query recent events.",
					},
				},
			},
		},
		{
			Name:        "get_character_profile",
			Description: "Get character biography, unit affiliation, and voice actor for any of the 26 characters.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"character_id": map[string]interface{}{
						"type":        "integer",
						"description": "Character ID (1 to 26). E.g. 1=星乃一歌, 21=初音未来",
					},
					"name": map[string]interface{}{
						"type":        "string",
						"description": "Character name (e.g. 初音未来, 星乃一歌, 宵崎奏)",
					},
				},
			},
		},
	}
}

func (s *Server) executeTool(name string, args map[string]interface{}) ToolCallResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	switch name {
	case "search_cards":
		return s.toolSearchCards(args)
	case "get_card_detail":
		return s.toolGetCardDetail(args)
	case "search_musics":
		return s.toolSearchMusics(args)
	case "get_music_detail":
		return s.toolGetMusicDetail(args)
	case "get_event_info":
		return s.toolGetEventInfo(args)
	case "get_character_profile":
		return s.toolGetCharacterProfile(args)
	default:
		return ToolCallResult{
			IsError: true,
			Content: []TextContent{{Type: "text", Text: fmt.Sprintf("Tool %s not found", name)}},
		}
	}
}

func (s *Server) toolSearchCards(args map[string]interface{}) ToolCallResult {
	query, _ := args["query"].(string)
	query = strings.TrimSpace(strings.ToLower(query))

	var charID int
	if cid, ok := args["character_id"].(float64); ok {
		charID = int(cid)
	}

	rarity, _ := args["rarity"].(string)
	attribute, _ := args["attribute"].(string)

	limit := 10
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
		if limit > 30 {
			limit = 30
		}
	}

	var matched []*CardItem
	for _, card := range s.cards {
		if charID > 0 && card.CharacterID != charID {
			continue
		}
		if rarity != "" && !strings.EqualFold(card.Rarity, rarity) {
			continue
		}
		if attribute != "" && !strings.EqualFold(card.Attr, attribute) {
			continue
		}
		if query != "" {
			cName := characterNames[card.CharacterID]
			combined := strings.ToLower(fmt.Sprintf("%s %s %s %s", cName, card.Prefix, card.SkillName, card.Attr))
			if !strings.Contains(combined, query) {
				continue
			}
		}
		matched = append(matched, card)
	}

	sort.Slice(matched, func(i, j int) bool {
		return matched[i].ID < matched[j].ID
	})

	if len(matched) > limit {
		matched = matched[:limit]
	}

	if len(matched) == 0 {
		return ToolCallResult{
			Content: []TextContent{{Type: "text", Text: "No cards matched your query."}},
		}
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Found %d cards:\n\n", len(matched)))
	for _, c := range matched {
		cName := characterNames[c.CharacterID]
		sb.WriteString(fmt.Sprintf("- **[%d] %s - %s** (%s | %s)\n", c.ID, cName, c.Prefix, c.Rarity, c.Attr))
		if c.SkillName != "" {
			sb.WriteString(fmt.Sprintf("  技能: %s\n", c.SkillName))
		}
		if c.Power != nil && c.Power.Normal != nil {
			sb.WriteString(fmt.Sprintf("  综合力: %d\n", c.Power.Normal.Total))
		}
		sb.WriteString(fmt.Sprintf("  链接: https://pjsk.moe/cards/%d/\n\n", c.ID))
	}

	return ToolCallResult{Content: []TextContent{{Type: "text", Text: sb.String()}}}
}

func (s *Server) toolGetCardDetail(args map[string]interface{}) ToolCallResult {
	var cardID int
	if cid, ok := args["card_id"].(float64); ok {
		cardID = int(cid)
	}
	if cardID <= 0 {
		return ToolCallResult{IsError: true, Content: []TextContent{{Type: "text", Text: "Missing valid card_id"}}}
	}

	card, ok := s.cards[cardID]
	if !ok {
		return ToolCallResult{IsError: true, Content: []TextContent{{Type: "text", Text: fmt.Sprintf("Card ID %d not found", cardID)}}}
	}

	cName := characterNames[card.CharacterID]
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# [%d] %s - %s\n\n", card.ID, cName, card.Prefix))
	sb.WriteString(fmt.Sprintf("- **角色**: %s (ID: %d)\n", cName, card.CharacterID))
	sb.WriteString(fmt.Sprintf("- **稀有度**: %s\n", card.Rarity))
	sb.WriteString(fmt.Sprintf("- **属性**: %s\n", card.Attr))
	if card.SkillName != "" {
		sb.WriteString(fmt.Sprintf("- **技能名称**: %s\n", card.SkillName))
	}
	if card.SkillDesc != "" {
		sb.WriteString(fmt.Sprintf("- **技能效果**: %s\n", card.SkillDesc))
	}

	if card.Power != nil {
		sb.WriteString("\n### 数值参数表 (Power Parameters)\n\n")
		sb.WriteString("| 阶段 | 表现力 (Performance) | 技巧 (Technique) | 体能 (Stamina) | 综合力 (Total) |\n")
		sb.WriteString("|---|---|---|---|---|\n")
		if card.Power.Normal != nil {
			n := card.Power.Normal
			sb.WriteString(fmt.Sprintf("| 通常 (特训前) | %d | %d | %d | %d |\n", n.Performance, n.Technique, n.Stamina, n.Total))
		}
		if card.Power.Trained != nil {
			t := card.Power.Trained
			sb.WriteString(fmt.Sprintf("| 特训后 (开花后) | %d | %d | %d | %d |\n", t.Performance, t.Technique, t.Stamina, t.Total))
		}
	}

	if card.Event != nil {
		sb.WriteString(fmt.Sprintf("\n- **登场活动**: [%d] %s\n", card.Event.ID, card.Event.Name))
	}
	sb.WriteString(fmt.Sprintf("\n在线详情页: https://pjsk.moe/cards/%d/\n", card.ID))

	return ToolCallResult{Content: []TextContent{{Type: "text", Text: sb.String()}}}
}

func (s *Server) toolSearchMusics(args map[string]interface{}) ToolCallResult {
	query, _ := args["query"].(string)
	query = strings.TrimSpace(strings.ToLower(query))

	limit := 10
	if l, ok := args["limit"].(float64); ok && l > 0 {
		limit = int(l)
		if limit > 30 {
			limit = 30
		}
	}

	var matched []*MusicItem
	for _, m := range s.musics {
		if query != "" {
			combined := strings.ToLower(fmt.Sprintf("%s %s %s", m.Title, m.Lyricist, m.Composer))
			if !strings.Contains(combined, query) {
				continue
			}
		}
		matched = append(matched, m)
	}

	sort.Slice(matched, func(i, j int) bool {
		return matched[i].ID < matched[j].ID
	})

	if len(matched) > limit {
		matched = matched[:limit]
	}

	if len(matched) == 0 {
		return ToolCallResult{Content: []TextContent{{Type: "text", Text: "No music found matching your search."}}}
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Found %d songs:\n\n", len(matched)))
	for _, m := range matched {
		sb.WriteString(fmt.Sprintf("- **[%d] %s**\n", m.ID, m.Title))
		if m.Lyricist != "" || m.Composer != "" {
			sb.WriteString(fmt.Sprintf("  作词: %s | 作曲: %s\n", m.Lyricist, m.Composer))
		}
		sb.WriteString(fmt.Sprintf("  详情页: https://pjsk.moe/music/%d/\n\n", m.ID))
	}

	return ToolCallResult{Content: []TextContent{{Type: "text", Text: sb.String()}}}
}

func (s *Server) toolGetMusicDetail(args map[string]interface{}) ToolCallResult {
	var musicID int
	if mid, ok := args["music_id"].(float64); ok {
		musicID = int(mid)
	}
	if musicID <= 0 {
		return ToolCallResult{IsError: true, Content: []TextContent{{Type: "text", Text: "Missing valid music_id"}}}
	}

	music, ok := s.musics[musicID]
	if !ok {
		return ToolCallResult{IsError: true, Content: []TextContent{{Type: "text", Text: fmt.Sprintf("Music ID %d not found", musicID)}}}
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# [%d] %s\n\n", music.ID, music.Title))
	if music.Lyricist != "" {
		sb.WriteString(fmt.Sprintf("- **作词**: %s\n", music.Lyricist))
	}
	if music.Composer != "" {
		sb.WriteString(fmt.Sprintf("- **作曲**: %s\n", music.Composer))
	}
	sb.WriteString(fmt.Sprintf("\n在线详情页: https://pjsk.moe/music/%d/\n", music.ID))

	return ToolCallResult{Content: []TextContent{{Type: "text", Text: sb.String()}}}
}

func (s *Server) toolGetEventInfo(args map[string]interface{}) ToolCallResult {
	var eventID int
	if eid, ok := args["event_id"].(float64); ok {
		eventID = int(eid)
	}

	if eventID > 0 {
		event, ok := s.events[eventID]
		if !ok {
			return ToolCallResult{IsError: true, Content: []TextContent{{Type: "text", Text: fmt.Sprintf("Event ID %d not found", eventID)}}}
		}
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("# [%d] %s\n\n", event.ID, event.Name))
		if event.Type != "" {
			sb.WriteString(fmt.Sprintf("- **活动类型**: %s\n", event.Type))
		}
		sb.WriteString(fmt.Sprintf("\n活动详情页: https://pjsk.moe/events/%d/\n", event.ID))
		return ToolCallResult{Content: []TextContent{{Type: "text", Text: sb.String()}}}
	}

	// Return recent 5 events
	var list []*EventItem
	for _, e := range s.events {
		list = append(list, e)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].ID > list[j].ID
	})

	if len(list) > 5 {
		list = list[:5]
	}

	var sb strings.Builder
	sb.WriteString("Recent Project SEKAI events:\n\n")
	for _, e := range list {
		sb.WriteString(fmt.Sprintf("- **[%d] %s** (%s)\n", e.ID, e.Name, e.Type))
		sb.WriteString(fmt.Sprintf("  https://pjsk.moe/events/%d/\n", e.ID))
	}

	return ToolCallResult{Content: []TextContent{{Type: "text", Text: sb.String()}}}
}

func (s *Server) toolGetCharacterProfile(args map[string]interface{}) ToolCallResult {
	var charID int
	if cid, ok := args["character_id"].(float64); ok {
		charID = int(cid)
	}
	name, _ := args["name"].(string)

	if charID <= 0 && name != "" {
		for id, cname := range characterNames {
			if strings.Contains(strings.ToLower(cname), strings.ToLower(strings.TrimSpace(name))) {
				charID = id
				break
			}
		}
	}

	if charID <= 0 || charID > 26 {
		return ToolCallResult{
			IsError: true,
			Content: []TextContent{{Type: "text", Text: "Character not found. Valid character_id is 1 to 26."}},
		}
	}

	cName := characterNames[charID]
	unit := characterUnits[charID]

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# %s (Character ID: %d)\n\n", cName, charID))
	sb.WriteString(fmt.Sprintf("- **所属乐团 / 队伍**: %s\n", unit))
	sb.WriteString(fmt.Sprintf("- **角色主页**: https://pjsk.moe/character/%d/\n", charID))

	// Count cards of this character
	cardCount := 0
	for _, c := range s.cards {
		if c.CharacterID == charID {
			cardCount++
		}
	}
	sb.WriteString(fmt.Sprintf("- **收录卡牌数**: %d 张\n", cardCount))

	return ToolCallResult{Content: []TextContent{{Type: "text", Text: sb.String()}}}
}

func (s *Server) readResource(uri string) []ResourceContent {
	switch uri {
	case "pjsk://characters":
		var list []map[string]interface{}
		for id := 1; id <= 26; id++ {
			list = append(list, map[string]interface{}{
				"id":   id,
				"name": characterNames[id],
				"unit": characterUnits[id],
			})
		}
		data, _ := json.MarshalIndent(list, "", "  ")
		return []ResourceContent{{
			URI:      uri,
			MimeType: "application/json",
			Text:     string(data),
		}}

	case "pjsk://events/latest":
		var list []*EventItem
		for _, e := range s.events {
			list = append(list, e)
		}
		sort.Slice(list, func(i, j int) bool {
			return list[i].ID > list[j].ID
		})
		if len(list) > 3 {
			list = list[:3]
		}
		data, _ := json.MarshalIndent(list, "", "  ")
		return []ResourceContent{{
			URI:      uri,
			MimeType: "application/json",
			Text:     string(data),
		}}

	default:
		return []ResourceContent{{
			URI:      uri,
			MimeType: "text/plain",
			Text:     "Resource not found",
		}}
	}
}
