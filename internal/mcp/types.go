package mcp

import "encoding/json"

// JSON-RPC 2.0 Request
type Request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// JSON-RPC 2.0 Response
type Response struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
}

type RPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// MCP Server Handshake Info
type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type ToolsCapability struct {
	ListChanged bool `json:"listChanged"`
}

type ResourcesCapability struct {
	Subscribe   bool `json:"subscribe"`
	ListChanged bool `json:"listChanged"`
}

type ServerCapabilities struct {
	Tools     ToolsCapability     `json:"tools"`
	Resources ResourcesCapability `json:"resources"`
}

type InitializeResult struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ServerCapabilities `json:"capabilities"`
	ServerInfo      ServerInfo         `json:"serverInfo"`
}

// Tool represents an available tool in MCP
type Tool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema interface{} `json:"inputSchema"`
}

type ToolsListResult struct {
	Tools []Tool `json:"tools"`
}

// Tool Execution Payload
type ToolCallParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

type TextContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type ToolCallResult struct {
	Content []TextContent `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

// Resource representations
type Resource struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	MimeType    string `json:"mimeType,omitempty"`
}

type ResourcesListResult struct {
	Resources []Resource `json:"resources"`
}

type ResourceReadParams struct {
	URI string `json:"uri"`
}

type ResourceContent struct {
	URI      string `json:"uri"`
	MimeType string `json:"mimeType,omitempty"`
	Text     string `json:"text,omitempty"`
}

type ResourceReadResult struct {
	Contents []ResourceContent `json:"contents"`
}

// Upstream Ranking and Event types
type RkEventItem struct {
	EventID          int    `json:"event_id"`
	Name             string `json:"name"`
	EventType        string `json:"event_type"`
	StartAt          int64  `json:"start_at"`
	EndAt            int64  `json:"end_at"`
	Status           string `json:"status"`
	HasFinalizedData bool   `json:"has_finalized_data"`
	HasRealtimeData  bool   `json:"has_realtime_data"`
}

type RkRankingItem struct {
	Rank        int      `json:"rank"`
	Score       int64    `json:"score"`
	Prediction  *float64 `json:"prediction"`
	CollectTime string   `json:"collect_time"`
	IsFinal     bool     `json:"is_final"`
}

type RkLatestResponse struct {
	EventID   int             `json:"event_id"`
	Status    string          `json:"status"`
	UpdatedAt string          `json:"updated_at"`
	Items     []RkRankingItem `json:"items"`
}

type V2RankingEntry struct {
	Rank        int    `json:"rank"`
	Score       int64  `json:"score"`
	Name        string `json:"name"`
	UserProfile *struct {
		Word string `json:"word"`
	} `json:"userProfile"`
}

type V2LatestResponse struct {
	EventID   int              `json:"event_id"`
	Region    string           `json:"region"`
	StartAt   int64            `json:"start_at"`
	EndAt     int64            `json:"end_at"`
	UpdatedAt int64            `json:"updated_at"`
	Rankings  []V2RankingEntry `json:"rankings"`
}
