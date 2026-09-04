package mcp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMCPServerHandshakeAndTools(t *testing.T) {
	s := New()

	// 1. GET /api/mcp
	reqGet := httptest.NewRequest(http.MethodGet, "/api/mcp", nil)
	rrGet := httptest.NewRecorder()
	s.ServeHTTP(rrGet, reqGet)
	if rrGet.Code != http.StatusOK {
		t.Fatalf("GET /api/mcp returned %d, want 200", rrGet.Code)
	}

	// 2. POST initialize
	initReq := Request{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "initialize",
	}
	body, _ := json.Marshal(initReq)
	reqPost := httptest.NewRequest(http.MethodPost, "/api/mcp", bytes.NewReader(body))
	rrPost := httptest.NewRecorder()
	s.ServeHTTP(rrPost, reqPost)
	if rrPost.Code != http.StatusOK {
		t.Fatalf("POST initialize returned %d, want 200", rrPost.Code)
	}

	var initRes Response
	if err := json.Unmarshal(rrPost.Body.Bytes(), &initRes); err != nil {
		t.Fatalf("Failed to parse initialize response: %v", err)
	}
	if initRes.Error != nil {
		t.Fatalf("initialize returned RPC error: %v", initRes.Error)
	}

	// 3. POST tools/list
	toolsReq := Request{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "tools/list",
	}
	toolsBody, _ := json.Marshal(toolsReq)
	reqTools := httptest.NewRequest(http.MethodPost, "/api/mcp", bytes.NewReader(toolsBody))
	rrTools := httptest.NewRecorder()
	s.ServeHTTP(rrTools, reqTools)
	if rrTools.Code != http.StatusOK {
		t.Fatalf("POST tools/list returned %d, want 200", rrTools.Code)
	}

	var toolsRes Response
	if err := json.Unmarshal(rrTools.Body.Bytes(), &toolsRes); err != nil {
		t.Fatalf("Failed to parse tools/list response: %v", err)
	}
	if toolsRes.Error != nil {
		t.Fatalf("tools/list returned error: %v", toolsRes.Error)
	}

	// 4. POST tools/call (get_character_profile)
	callParams, _ := json.Marshal(map[string]interface{}{
		"name": "get_character_profile",
		"arguments": map[string]interface{}{
			"character_id": 21,
		},
	})
	callReq := Request{
		JSONRPC: "2.0",
		ID:      3,
		Method:  "tools/call",
		Params:  callParams,
	}
	callBody, _ := json.Marshal(callReq)
	reqCall := httptest.NewRequest(http.MethodPost, "/api/mcp", bytes.NewReader(callBody))
	rrCall := httptest.NewRecorder()
	s.ServeHTTP(rrCall, reqCall)
	if rrCall.Code != http.StatusOK {
		t.Fatalf("POST tools/call returned %d, want 200", rrCall.Code)
	}

	var callRes Response
	if err := json.Unmarshal(rrCall.Body.Bytes(), &callRes); err != nil {
		t.Fatalf("Failed to parse tools/call response: %v", err)
	}
	if callRes.Error != nil {
		t.Fatalf("tools/call returned error: %v", callRes.Error)
	}

	// 5. POST resources/list
	resReq := Request{
		JSONRPC: "2.0",
		ID:      4,
		Method:  "resources/list",
	}
	resBody, _ := json.Marshal(resReq)
	reqRes := httptest.NewRequest(http.MethodPost, "/api/mcp", bytes.NewReader(resBody))
	rrRes := httptest.NewRecorder()
	s.ServeHTTP(rrRes, reqRes)
	if rrRes.Code != http.StatusOK {
		t.Fatalf("POST resources/list returned %d, want 200", rrRes.Code)
	}
}
