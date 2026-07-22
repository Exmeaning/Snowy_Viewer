package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"snowy_viewer/internal/masterdata"
	"snowy_viewer/internal/models"
)

func TestGachaListPaginationHandlesLargeIntegers(t *testing.T) {
	maxInt := int(^uint(0) >> 1)
	tests := []struct {
		name       string
		query      string
		wantGachas int
	}{
		{
			name:       "large page",
			query:      "page=" + strconv.Itoa(maxInt) + "&limit=2",
			wantGachas: 0,
		},
		{
			name:       "large limit after first page",
			query:      "page=2&limit=" + strconv.Itoa(maxInt),
			wantGachas: 0,
		},
		{
			name:       "large limit on first page",
			query:      "page=1&limit=" + strconv.Itoa(maxInt),
			wantGachas: 3,
		},
		{
			name:       "ordinary final page",
			query:      "page=2&limit=2",
			wantGachas: 1,
		},
	}

	store := masterdata.NewStore("")
	store.GachaList = []models.Gacha{{ID: 1}, {ID: 2}, {ID: 3}}
	mux := http.NewServeMux()
	New(store).RegisterRoutes(mux)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/api/gachas?"+tt.query, nil)
			response := httptest.NewRecorder()

			mux.ServeHTTP(response, request)

			if response.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
			}

			var body models.GachaListResponse
			if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if len(body.Gachas) != tt.wantGachas {
				t.Fatalf("gachas = %d, want %d", len(body.Gachas), tt.wantGachas)
			}
		})
	}
}
