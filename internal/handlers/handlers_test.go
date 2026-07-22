package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"snowy_viewer/internal/masterdata"
	"snowy_viewer/internal/models"
)

func gachaHandlerForTest() *Handler {
	store := masterdata.NewStore("")
	store.GachaList = []models.Gacha{
		{ID: 1, Name: "First", StartAt: 1},
		{ID: 2, Name: "Second", StartAt: 2},
	}
	return New(store)
}

func TestGachaPaginationRejectsUnsafeValues(t *testing.T) {
	handler := gachaHandlerForTest()
	for _, query := range []string{
		"page=9223372036854775807&limit=2",
		"page=1&limit=9223372036854775807",
		"page=-1&limit=2",
		"page=invalid&limit=2",
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

func TestGachaPaginationAllowsBoundedEmptyPage(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/gachas?page=1000000&limit=100", nil)
	gachaHandlerForTest().handleGachaList(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	var response models.GachaListResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Page != maxGachaPage || response.Limit != maxGachaLimit || len(response.Gachas) != 0 {
		t.Fatalf("response = %#v, want bounded empty page", response)
	}
}
