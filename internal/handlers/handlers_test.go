package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"snowy_viewer/internal/masterdata"
	"snowy_viewer/internal/models"
)

func gachaHandlerForTest(t *testing.T) *Handler {
	t.Helper()
	dir := t.TempDir()
	for _, filename := range []string{"events.json", "eventCards.json", "eventMusics.json", "virtualLives.json", "gachas.json"} {
		if err := os.WriteFile(filepath.Join(dir, filename), []byte("[]"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	store := masterdata.NewStore(dir)
	if err := store.Fetch(); err != nil {
		t.Fatal(err)
	}
	store.GachaList = []models.Gacha{
		{ID: 1, Name: "First", StartAt: 1},
		{ID: 2, Name: "Second", StartAt: 2},
		{ID: 3, Name: "Third", StartAt: 3},
	}
	return New(store)
}

func TestGachaPaginationRejectsUnsafeValues(t *testing.T) {
	handler := gachaHandlerForTest(t)
	for _, query := range []string{
		"page=9223372036854775807&limit=2",
		"page=1&limit=9223372036854775807",
		"page=-1&limit=2",
		"page=invalid&limit=2",
		"page=1&limit=101",
	} {
		t.Run(query, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/api/gachas?"+query, nil)
			handler.handleGachaList(recorder, request)
			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
			}
			var response map[string]string
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if response["error"] == "" {
				t.Fatal("expected a bounded pagination error")
			}
		})
	}
}

func TestGachaPaginationHandlesBoundedPages(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		wantPage   int
		wantLimit  int
		wantGachas int
	}{
		{
			name:       "maximum bounded page is empty",
			query:      "page=1000000&limit=100",
			wantPage:   maxGachaPage,
			wantLimit:  maxGachaLimit,
			wantGachas: 0,
		},
		{
			name:       "ordinary final page",
			query:      "page=2&limit=2",
			wantPage:   2,
			wantLimit:  2,
			wantGachas: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/api/gachas?"+tt.query, nil)
			gachaHandlerForTest(t).handleGachaList(recorder, request)

			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
			}
			var response models.GachaListResponse
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if response.Page != tt.wantPage || response.Limit != tt.wantLimit || len(response.Gachas) != tt.wantGachas {
				t.Fatalf("response = %#v, want page=%d limit=%d gachas=%d", response, tt.wantPage, tt.wantLimit, tt.wantGachas)
			}
		})
	}
}

func TestMasterDataEndpointsReturnRetryableServiceUnavailableBeforeStartupLoad(t *testing.T) {
	handler := New(masterdata.NewStore(t.TempDir()))
	recorder := httptest.NewRecorder()
	handler.handleCardEventMap(recorder, httptest.NewRequest(http.MethodGet, "/api/card-event-map", nil))

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusServiceUnavailable)
	}
	if recorder.Header().Get("Retry-After") != masterDataRetryAfter {
		t.Fatalf("Retry-After = %q, want %q", recorder.Header().Get("Retry-After"), masterDataRetryAfter)
	}
	if recorder.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("Cache-Control = %q, want no-store", recorder.Header().Get("Cache-Control"))
	}
}
